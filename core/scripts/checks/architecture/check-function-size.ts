import { Glob } from 'bun';
import fs from 'node:fs';
import ts from 'typescript';

const MAX_FILE_LINES = 3_000;
const EXCLUDED_PATH = /\/(?:__tests__|qa|scenarios|scripts)\//;

const SCOPES = {
  'state-machine': { roots: ['core/runtime', 'core/entity', 'core/account'], maxFn: 100 },
  production: { roots: ['core'], maxFn: 150 },
} as const;

type FunctionSize = { file: string; name: string; lines: number; start: number };

const callbackOwner = (node: ts.FunctionLikeDeclaration, source: ts.SourceFile): string | null => {
  let parent: ts.Node | undefined = node.parent;
  while (parent && !ts.isFunctionLike(parent)) {
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      return `${parent.left.getText(source)} callback`;
    }
    if (ts.isCallExpression(parent)) {
      const expression = parent.expression.getText(source);
      if (!expression.startsWith('(')) return `${expression} callback`;
    }
    parent = parent.parent;
  }
  return null;
};

const functionName = (node: ts.FunctionLikeDeclaration, source: ts.SourceFile, start: number): string => {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  if (ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) return node.parent.name.text;
  if (ts.isMethodDeclaration(node) && node.name) return node.name.getText(source);
  return callbackOwner(node, source) ?? `anonymous@${start}`;
};

const collectFunctionSizes = (file: string, text: string): FunctionSize[] => {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const functions: FunctionSize[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node) && 'body' in node && node.body) {
      const declaration = node as ts.FunctionLikeDeclaration;
      const start = source.getLineAndCharacterOfPosition(declaration.getStart(source)).line + 1;
      const end = source.getLineAndCharacterOfPosition(declaration.end).line + 1;
      functions.push({ file, name: functionName(declaration, source, start), lines: end - start + 1, start });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return functions;
};

const scopeName = process.argv.find(argument => argument.startsWith('--scope='))?.slice('--scope='.length);
const scope = SCOPES[scopeName as keyof typeof SCOPES];
if (!scope) throw new Error(`Usage: bun check-function-size.ts --scope=${Object.keys(SCOPES).join('|')} [--list]`);

const files = scope.roots
  .flatMap(root => [...new Glob(`${root}/**/*.ts`).scanSync({ dot: true, onlyFiles: true })])
  .filter(file => !file.endsWith('.d.ts') && !file.endsWith('.test.ts') && !file.endsWith('.spec.ts'))
  .filter(file => !EXCLUDED_PATH.test(`/${file}`))
  .sort();

const errors: string[] = [];
const oversized: FunctionSize[] = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/).length;
  if (lines > MAX_FILE_LINES) errors.push(`FILE_TOO_LARGE ${file}:${lines} > ${MAX_FILE_LINES}`);
  oversized.push(...collectFunctionSizes(file, text).filter(entry => entry.lines > scope.maxFn));
}

if (process.argv.includes('--list')) {
  for (const entry of [...oversized].sort((left, right) => right.lines - left.lines)) {
    console.log(`${entry.lines}\t${entry.file}:${entry.start}\t${entry.name}`);
  }
}
for (const entry of oversized) {
  errors.push(`FUNCTION_TOO_LONG ${entry.file}::${entry.name}:${entry.start} lines=${entry.lines} > ${scope.maxFn}`);
}

if (errors.length > 0) {
  console.error(`Function-size invariant failed (${scopeName}):\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`FUNCTION_SIZE_OK scope=${scopeName} files=${files.length} maxFile=${MAX_FILE_LINES} maxFn=${scope.maxFn}`);
