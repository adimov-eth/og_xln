// Reachability of the rewrite (the layers xln/*.ts): every top-level declaration must be reachable from a root, or it
// is dead code. Roots are the names any other .ts file under pure/ mentions (tests, xln_run.ts, benches; not this
// gate, the barrel xln.ts or the split's module map) and the names used by top-level statements that declare nothing
// (an import or export list is not such a statement). An edge runs from a declaration to every top-level name it
// mentions, in any layer.
// Mentions are matched by name, not by binding, so a name in a comment or a shadowing local keeps a declaration
// alive: the scan can miss dead code, but never reports live code as dead.
import ts from "typescript";
import { readFileSync } from "node:fs";
import { LAYERS } from "../split/layers.ts";

type Declared = { readonly name: string; readonly node: ts.Node; readonly source: ts.SourceFile };
export type Unreachable = { readonly name: string; readonly file: string; readonly line: number };

const dir = `${import.meta.dir}/..`;
const layerFiles = LAYERS.map((layer) => `xln/${layer}.ts`);
const sources = layerFiles.map((f) =>
  ts.createSourceFile(f, readFileSync(`${dir}/${f}`, "utf8"), ts.ScriptTarget.ES2022, true));

const named = (source: ts.SourceFile) => (st: ts.Statement): readonly Declared[] => {
  switch (true) {
    case ts.isVariableStatement(st):
      return st.declarationList.declarations
        .flatMap((d) => (ts.isIdentifier(d.name) ? [{ name: d.name.text, node: d, source }] : []));
    case ts.isFunctionDeclaration(st):
    case ts.isClassDeclaration(st):
    case ts.isTypeAliasDeclaration(st):
    case ts.isInterfaceDeclaration(st):
    case ts.isEnumDeclaration(st):
      return st.name === undefined ? [] : [{ name: st.name.text, node: st, source }];
    default:
      return [];
  }
};

const identifiers = (source: ts.SourceFile) => (n: ts.Node): readonly string[] =>
  [...(ts.isIdentifier(n) ? [n.text] : []), ...n.getChildren(source).flatMap(identifiers(source))];

const declared = sources.flatMap((source) => source.statements.flatMap(named(source)));
const names = new Set(declared.map((d) => d.name));
const edges = new Map(
  [...Map.groupBy(declared, (d) => d.name)].map(([name, ds]) => [
    name,
    ds.flatMap((d) => identifiers(d.source)(d.node)).filter((x) => names.has(x)),
  ]),
);

const excluded = new Set(["xln.ts", ...layerFiles]);
const otherFiles = [...new Bun.Glob("**/*.ts").scanSync({ cwd: dir })]
  .filter((f) => !excluded.has(f) && !["node_modules/", "db-tmp/", "style/", "split/"].some((d) => f.startsWith(d)));
const words = (f: string): readonly string[] => readFileSync(`${dir}/${f}`, "utf8").match(/[A-Za-z_$][\w$]*/g) ?? [];
const mentioned = new Set(otherFiles.flatMap(words));
const declaresNothing = (source: ts.SourceFile) => (st: ts.Statement): boolean =>
  named(source)(st).length === 0 && !ts.isImportDeclaration(st) && !ts.isExportDeclaration(st);
const statementRoots = sources.flatMap((source) =>
  source.statements.filter(declaresNothing(source)).flatMap(identifiers(source)));
const roots = [...[...names].filter((n) => mentioned.has(n)), ...statementRoots.filter((n) => names.has(n))];

/** Breadth-first closure: each layer adds the names the previous layer mentions and nothing has reached yet. */
const reach = (frontier: readonly string[], seen: ReadonlySet<string>): ReadonlySet<string> => {
  const fresh = [...new Set(frontier)].filter((n) => !seen.has(n));
  return fresh.length === 0 ? seen : reach(fresh.flatMap((n) => edges.get(n) ?? []), new Set([...seen, ...fresh]));
};
const reached = reach(roots, new Set());

export const unreachable: readonly Unreachable[] = declared
  .filter((d) => !reached.has(d.name))
  .map((d) => ({
    name: d.name,
    file: d.source.fileName,
    line: d.source.getLineAndCharacterOfPosition(d.node.getStart(d.source)).line + 1,
  }));
