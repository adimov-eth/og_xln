// Splits the monolithic xln.ts into its layers, xln/{base,account,entity,runtime}.ts, and turns xln.ts into the
// barrel that re-exports them. Run from pure/: `bun split/split.ts`. See split/README.md.
//
// The split is mechanical, so it can be re-run on any later monolith instead of hand-merging a move:
//   1. read every top-level statement of xln.ts and, through the type checker, the declarations it mentions;
//   2. give each declaration its home layer from split/layers.ts;
//   3. sink each declaration to the lowest layer that uses it, so every import points down and none cycles;
//   4. write each layer as the original statements, byte for byte and in file order, under the section headers they
//      sat under, with generated import and export lists;
//   5. check that the layers hold exactly the monolith's statements, and write split/moves.txt.
import ts from "typescript";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { LAYERS, PINS, RUNS, type Layer } from "./layers.ts";

const dir = `${import.meta.dir}/..`;
const monolith = `${dir}/xln.ts`;
const MAX_LINE = 120;

// ---- the monolith as statements ----

/** One top-level statement of the monolith: what it declares and the text it carries. */
type Statement = {
  readonly index: number;
  readonly names: readonly string[];
  readonly exported: boolean;
  /** Erased at run time: a type alias, an interface or an ambient `declare`. */
  readonly typeOnly: boolean;
  readonly isImport: boolean;
  /** The section header this statement opens, when it opens one. */
  readonly header: string | undefined;
  /** Leading comments and blank lines, without the header. */
  readonly trivia: string;
  readonly code: string;
};

/** A mention of a top-level name: which statement declares it, or which import brings it in. */
type Mention =
  | { readonly _tag: "declared"; readonly statement: number; readonly name: string }
  | { readonly _tag: "imported"; readonly statement: number; readonly specifier: string };

const failWith = (message: string): never => {
  console.error(`split: ${message}`);
  return process.exit(1);
};
/** Stops the split, before it writes anything, unless `holds`. */
const demand = (holds: boolean, message: () => string): void => {
  if (!holds) failWith(message());
};

const program = ts.createProgram([monolith], {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  noEmit: true,
  allowImportingTsExtensions: true,
  skipLibCheck: true,
  types: [],
});
const checker = program.getTypeChecker();
const source = program.getSourceFile(monolith) ?? failWith("cannot read xln.ts");
demand(
  !source.statements.every((st) => ts.isExportDeclaration(st)),
  () => "xln.ts is already the barrel; restore the monolith first: git checkout origin/main -- xln.ts",
);
const text = source.getFullText();

const namesOf = (st: ts.Statement): readonly string[] => {
  switch (true) {
    case ts.isVariableStatement(st):
      return st.declarationList.declarations.flatMap((d) => (ts.isIdentifier(d.name) ? [d.name.text] : []));
    case ts.isFunctionDeclaration(st):
    case ts.isClassDeclaration(st):
    case ts.isInterfaceDeclaration(st):
    case ts.isTypeAliasDeclaration(st):
    case ts.isEnumDeclaration(st):
      return st.name === undefined ? [] : [st.name.text];
    default:
      return [];
  }
};

const hasModifier = (st: ts.Statement, kind: ts.SyntaxKind): boolean =>
  ts.canHaveModifiers(st) && (ts.getModifiers(st) ?? []).some((m) => m.kind === kind);

/**
 * A section header is a comment block opening with `// ---- ` and closing at the first line that ends in `----`;
 * a header line with no closing line is a header of one line.
 */
const splitHeader = (trivia: string): { readonly header: string | undefined; readonly rest: string } => {
  const lines = trivia.split("\n");
  const start = lines.findIndex((l) => l.startsWith("// ---- "));
  const comments = lines.slice(start).findIndex((l) => !l.startsWith("//"));
  const block = lines.slice(start, comments === -1 ? lines.length : start + comments);
  const closing = block.findIndex((l) => l.endsWith("----"));
  const length = closing === -1 ? 1 : closing + 1;
  return start === -1
    ? { header: undefined, rest: trivia }
    : {
      header: lines.slice(start, start + length).join("\n"),
      rest: [...lines.slice(0, start), ...lines.slice(start + length)].join("\n"),
    };
};

const statements: readonly Statement[] = source.statements.map((st, index) => {
  const { header, rest } = splitHeader(text.slice(st.getFullStart(), st.getStart(source)));
  return {
    index,
    names: namesOf(st),
    exported: hasModifier(st, ts.SyntaxKind.ExportKeyword),
    typeOnly: ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st)
      || hasModifier(st, ts.SyntaxKind.DeclareKeyword),
    isImport: ts.isImportDeclaration(st),
    header,
    trivia: rest,
    code: st.getText(source),
  };
});

demand(
  text.slice(source.endOfFileToken.getFullStart()).trim() === "",
  () => "xln.ts ends in comments after its last statement",
);

const statementOf = new Map(source.statements.map((st, i) => [st as ts.Node, i]));

const importSpecifier = (decl: ts.Declaration): string | undefined =>
  ts.isImportSpecifier(decl)
    ? decl.getText(source)
    : ts.isImportClause(decl) || ts.isNamespaceImport(decl)
      ? failWith(`only named imports are split, not ${decl.getText(source)}`)
      : undefined;

/** The top-level statement a declaration is, when it is one: not a property, parameter or local inside one. */
const declaringStatement = (decl: ts.Declaration): number | undefined => {
  const node = ts.isVariableDeclaration(decl)
    ? decl.parent.parent
    : ts.isImportSpecifier(decl) ? decl.parent.parent.parent : decl;
  return decl.getSourceFile() === source && node.parent === source ? statementOf.get(node) : undefined;
};

const mentionOf = (self: number, id: ts.Identifier): readonly Mention[] => {
  const decl = checker.getSymbolAtLocation(id)?.declarations?.[0];
  const owner = decl === undefined ? undefined : declaringStatement(decl);
  const specifier = decl === undefined ? undefined : importSpecifier(decl);
  return owner === undefined || owner === self
    ? []
    : specifier === undefined
      ? [{ _tag: "declared", statement: owner, name: id.text }]
      : [{ _tag: "imported", statement: owner, specifier }];
};

const mentionsIn = (self: number, node: ts.Node): readonly Mention[] => [
  ...(ts.isIdentifier(node) ? mentionOf(self, node) : []),
  ...node.getChildren(source).flatMap((child) => mentionsIn(self, child)),
];

const mentions: readonly (readonly Mention[])[] = source.statements.map((st, i) => mentionsIn(i, st));

// ---- homes: the layer split/layers.ts gives each statement ----

const byName = new Map(statements.flatMap((s) => s.names.map((n) => [n, s.index] as const)));
const missing = [...RUNS.map(([name]) => name), ...Object.keys(PINS)].filter((n) => !byName.has(n));
demand(missing.length === 0, () => `split/layers.ts names declarations xln.ts lacks: ${missing.join(", ")}`);

const levelOf = (layer: Layer): number => LAYERS.indexOf(layer);
const runs = RUNS.map(([name, layer]) => ({ start: byName.get(name) ?? 0, level: levelOf(layer) }));
const pinOf = (s: Statement): number | undefined => {
  const pinned = s.names.map((n) => PINS[n]).find((layer) => layer !== undefined);
  return pinned === undefined ? undefined : levelOf(pinned);
};
const pins: readonly (number | undefined)[] = statements.map(pinOf);
const homes: readonly number[] = statements.map((s) =>
  pins[s.index] ?? runs.findLast((r) => r.start <= s.index)?.level ?? 0);

// ---- levels: each statement sinks to the lowest layer among its users, but never below an anchor it uses ----

const edges = statements.flatMap((s) => [
  ...mentions[s.index]!.flatMap((m) => (m._tag === "declared" ? [{ used: m.statement, user: s.index }] : [])),
  // A statement that declares nothing (msgpackr's addExtension) runs with the declaration after it.
  ...(s.names.length === 0 && !s.isImport && s.index + 1 < statements.length
    ? [{ used: s.index, user: s.index + 1 }]
    : []),
]);
const grouped = (key: "used" | "user", other: "used" | "user"): readonly (readonly number[])[] => {
  const groups = Map.groupBy(edges, (e) => e[key]);
  return statements.map((s) => [...new Set((groups.get(s.index) ?? []).map((e) => e[other]))]);
};
/** Statement -> the statements that mention it, and -> the statements it mentions. */
const users = grouped("used", "user");
const uses = grouped("user", "used");

const fixpoint = (xs: readonly number[], step: (xs: readonly number[]) => readonly number[]): readonly number[] => {
  const next = step(xs);
  return next.every((x, i) => x === xs[i]) ? xs : fixpoint(next, step);
};
/** The lowest layer each statement may sit in: the highest anchor it reaches through what it uses. */
const floors = fixpoint(
  statements.map((s) => pins[s.index] ?? 0),
  (fs) => fs.map((f, i) => Math.max(f, ...uses[i]!.map((u) => fs[u]!))),
);
const levels = fixpoint(
  homes.map((h, i) => Math.max(h, floors[i]!)),
  (ls) => ls.map((_, i) => Math.max(floors[i]!, Math.min(homes[i]!, ...users[i]!.map((u) => ls[u]!)))),
);
const pulledBelowAnchor = statements.flatMap((s) => {
  const pin = pins[s.index];
  const low = users[s.index]!.find((u) => levels[u]! < (pin ?? 0));
  const by = low === undefined ? "?" : statements[low]!.names[0];
  return pin === undefined || levels[s.index] === pin
    ? []
    : [`${s.names[0]} (${LAYERS[pin]}) is used in ${LAYERS[levels[s.index]!]} by ${by}`];
});
demand(pulledBelowAnchor.length === 0, () => `anchors pulled down: ${pulledBelowAnchor.join("; ")}`);

// ---- writing the layers ----

const wrapList = (open: string, items: readonly string[], close: string): string => {
  const oneLine = `${open} ${items.join(", ")} ${close}`;
  const lines = items.reduce<readonly string[]>((acc, item) => {
    const last = acc.at(-1);
    return last !== undefined && `${last}, ${item},`.length <= MAX_LINE
      ? [...acc.slice(0, -1), `${last}, ${item}`]
      : [...acc, `  ${item}`];
  }, []);
  return oneLine.length <= MAX_LINE ? oneLine : `${open}\n${lines.map((l) => `${l},`).join("\n")}\n${close}`;
};

const typeNames = new Set(statements.filter((s) => s.typeOnly).flatMap((s) => s.names));
const sortedNames = (names: Iterable<string>): readonly string[] => [...new Set(names)].sort();
const importItem = (name: string): string => (typeNames.has(name) ? `type ${name}` : name);

const moduleFile = (level: number): string => `${LAYERS[level]}.ts`;

const LAYER_DOCS: Readonly<Record<Layer, string>> = {
  base: "The shared base: vocabulary, codecs, ABI, signatures and the pieces every layer below the Runtime reads.",
  account: "The Account layer: the bilateral Account, its txs, its consensus and its disputes.",
  entity: "The Entity layer: Entity state, txs, consensus, the J prefix and the hub's books.",
  runtime: "The Runtime layer: intake, the R -> E -> A cascade of one Runtime frame, the WAL and the network outbox.",
};

const writeLayer = (level: number): string => {
  const own = statements.filter((s) => !s.isImport && levels[s.index] === level);
  const ownMentions = own.flatMap((s) => mentions[s.index]!);
  const externals = statements.filter((s) => s.isImport).flatMap((s) => {
    const specifiers = sortedNames(ownMentions.flatMap((m) =>
      (m._tag === "imported" && m.statement === s.index ? [m.specifier] : [])));
    const from = (source.statements[s.index] as ts.ImportDeclaration).moduleSpecifier.getText(source);
    return specifiers.length === 0 ? [] : [wrapList("import {", specifiers, `} from ${from};`)];
  });
  const lower = LAYERS.slice(0, level).flatMap((_, below) => {
    const names = sortedNames(ownMentions.flatMap((m) =>
      (m._tag === "declared" && levels[m.statement] === below ? [m.name] : [])));
    return names.length === 0 ? [] : [wrapList("import {", names.map(importItem), `} from "./${moduleFile(below)}";`)];
  });
  const [, body] = own.reduce<readonly [string | undefined, string]>(([section, out], s) => {
    const opens = s.header ?? (sectionOf[s.index] === section ? undefined : sectionOf[s.index]);
    const piece = opens === undefined
      ? `${s.trivia}${s.code}`
      : `\n\n${opens}\n${s.trivia.replace(/^\n+/, "")}${s.code}`;
    return [sectionOf[s.index], `${out}${piece}`];
  }, [undefined, ""]);
  const exportedAbove = new Set(
    statements.filter((s) => levels[s.index]! > level).flatMap((s) => mentions[s.index]!)
      .flatMap((m) => (m._tag === "declared" && levels[m.statement] === level ? [m.name] : [])),
  );
  const needExport = own.filter((s) => !s.exported).flatMap((s) => s.names.filter((n) => exportedAbove.has(n)));
  const valueExports = sortedNames(needExport.filter((n) => !typeNames.has(n)));
  const typeExports = sortedNames(needExport.filter((n) => typeNames.has(n)));
  const exportLines = [
    ...(valueExports.length === 0 ? [] : [wrapList("export {", valueExports, "};")]),
    ...(typeExports.length === 0 ? [] : [wrapList("export type {", typeExports, "};")]),
  ];
  const doc = [
    `// ${LAYER_DOCS[LAYERS[level]!]}`,
    `// Generated by split/split.ts from the monolithic xln.ts. Imports point down: ${LAYERS.join(" <- ")}.`,
  ].join("\n");
  const imports = [...externals, ...lower].join("\n");
  const exportsBlock = exportLines.length === 0 ? "" : `\n\n// Used by the layers above.\n${exportLines.join("\n")}`;
  return `${doc}\n${imports}${body}${exportsBlock}\n`;
};

/** The header each statement sits under: its own, or the last one before it. */
const headed = statements.filter((s) => s.header !== undefined);
const sectionOf: readonly (string | undefined)[] = statements.map((s) =>
  headed.findLast((h) => h.index <= s.index)?.header);

const layerTexts = LAYERS.map((_, level) => writeLayer(level));

// ---- the check: the layers hold exactly the monolith's statements ----

const layerStatements = layerTexts.flatMap((layerText, level) => {
  const file = ts.createSourceFile(moduleFile(level), layerText, ts.ScriptTarget.ES2022, true);
  return file.statements
    .filter((st) => !ts.isImportDeclaration(st) && !ts.isExportDeclaration(st))
    .map((st) => st.getText(file));
});
const originalStatements = statements.filter((s) => !s.isImport).map((s) => s.code);
const sameStatements = (() => {
  const a = [...originalStatements].sort();
  const b = [...layerStatements].sort();
  return a.length === b.length && a.every((x, i) => x === b[i]);
})();
demand(
  sameStatements,
  () => `the layers do not hold the monolith's statements (${layerStatements.length} vs ${originalStatements.length})`,
);
const upward = statements.flatMap((s) => mentions[s.index]!.flatMap((m) =>
  m._tag === "declared" && levels[m.statement]! > levels[s.index]! ? [`${s.names[0]} -> ${m.name}`] : []));
demand(upward.length === 0, () => `imports point up: ${upward.join(", ")}`);

// ---- the record: what left its home ----

const lowestUser = (i: number): string => {
  const user = users[i]!.find((u) => levels[u] === levels[i]);
  return user === undefined ? "" : (statements[user]!.names[0] ?? "(a statement)");
};
const anchorUsed = (i: number): string => {
  const used = uses[i]!.find((u) => floors[u] === levels[i]);
  return used === undefined ? "" : (statements[used]!.names[0] ?? "(a statement)");
};
const moves = statements.filter((s) => levels[s.index] !== homes[s.index]).map((s) =>
  `${(s.names.join(", ") || "(a statement)").padEnd(48)} ${LAYERS[homes[s.index]!]} -> ${LAYERS[levels[s.index]!]}` +
  (levels[s.index]! < homes[s.index]! ? `  (used by ${lowestUser(s.index)})` : `  (uses ${anchorUsed(s.index)})`));
const sizes = LAYERS.map((layer, level) => {
  const declarations = statements.filter((s) => !s.isImport && levels[s.index] === level).length;
  const lines = layerTexts[level]!.split("\n").length;
  return `${layer.padEnd(8)} ${String(declarations).padStart(5)} statements ${String(lines).padStart(6)} lines`;
});

const barrel = [
  "// The rewrite's public surface: the Runtime, Entity and Account layers and their shared base, in xln/.",
  "// Generated by split/split.ts from the monolithic xln.ts (split/README.md).",
  ...LAYERS.map((_, level) => `export * from "./xln/${moduleFile(level)}";`),
  "",
].join("\n");

mkdirSync(`${dir}/xln`, { recursive: true });
layerTexts.forEach((layerText, level) => writeFileSync(`${dir}/xln/${moduleFile(level)}`, layerText));
writeFileSync(monolith, barrel);
writeFileSync(`${dir}/split/moves.txt`, [
  "# Generated by split/split.ts. Declarations that left their home layer (split/layers.ts):",
  "# sunk to the layer of a lower user, or lifted to the layer of an anchor they use.",
  ...sizes.map((l) => `# ${l}`),
  ...moves,
  "",
].join("\n"));
sizes.forEach((l) => console.log(l));
console.log(`${moves.length} declarations left their home layer (split/moves.txt)`);
console.log(`${originalStatements.length} statements, each in exactly one layer`);
