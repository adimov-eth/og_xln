// Layering of the rewrite: a layer (xln/<layer>.ts) may import npm packages and the layers below it, written
// `./<layer>.ts`, and nothing else. Every module path is read from the syntax tree: static imports and re-exports,
// `import("...")` types, and dynamic `import(...)` and `require(...)` calls. Any other path (no extension, the barrel
// `../xln.ts`, a higher or the same layer, a relative file outside xln/) is a hit, and so is a dynamic `import` or
// `require` whose path is not a string literal, since no gate can read where it points.
import ts from "typescript";
import { readFileSync } from "node:fs";
import { LAYERS } from "../split/layers.ts";

export type UpwardImport = { readonly file: string; readonly line: number; readonly path: string };

const dir = `${import.meta.dir}/..`;

/** A module path a node names: a string literal, or an expression no gate can read. */
type Named = ts.StringLiteralLike | ts.Expression;
const opaque = "(not a string literal)";

/** The module path a node names, when it names one. */
const modulePath = (n: ts.Node): Named | undefined => {
  switch (true) {
    case ts.isImportDeclaration(n):
    case ts.isExportDeclaration(n):
      return n.moduleSpecifier !== undefined && ts.isStringLiteralLike(n.moduleSpecifier)
        ? n.moduleSpecifier
        : undefined;
    case ts.isImportTypeNode(n):
      return ts.isLiteralTypeNode(n.argument) && ts.isStringLiteralLike(n.argument.literal)
        ? n.argument.literal
        : undefined;
    case ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword:
    case ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "require": {
      const [arg] = (n as ts.CallExpression).arguments;
      return arg ?? (n as ts.CallExpression);
    }
    default:
      return undefined;
  }
};

const paths = (source: ts.SourceFile) => (n: ts.Node): readonly Named[] => {
  const own = modulePath(n);
  return [...(own === undefined ? [] : [own]), ...n.getChildren(source).flatMap(paths(source))];
};

const pathText = (p: Named): string => (ts.isStringLiteralLike(p) ? p.text : opaque);
const isPackage = (path: string): boolean => path !== opaque && !path.startsWith(".") && !path.startsWith("/");

export const upwardImports: readonly UpwardImport[] = LAYERS.flatMap((layer, level) => {
  const file = `xln/${layer}.ts`;
  const source = ts.createSourceFile(file, readFileSync(`${dir}/${file}`, "utf8"), ts.ScriptTarget.ES2022, true);
  const allowed = new Set(LAYERS.slice(0, level).map((below) => `./${below}.ts`));
  return paths(source)(source)
    .filter((p) => !isPackage(pathText(p)) && !allowed.has(pathText(p)))
    .map((p) => ({ file, line: source.getLineAndCharacterOfPosition(p.getStart(source)).line + 1, path: pathText(p) }));
});
