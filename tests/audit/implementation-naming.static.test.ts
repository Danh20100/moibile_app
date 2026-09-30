import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const excludedDirectories = new Set([
  'docs',
  '.git',
  'node_modules',
  '.venv',
  'build',
  '__pycache__',
]);
const forbiddenLevelName = new RegExp(`l${'v'}[123]`, 'i');

function walk(root: string, directory = root): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(root, path));
    else files.push(path);
  }
  return files;
}

export function findImplementationNamingViolations(root: string): string[] {
  const violations: string[] = [];
  const files = walk(root);

  for (const file of files) {
    const projectPath = relative(root, file).replaceAll('\\', '/');
    if (forbiddenLevelName.test(projectPath)) violations.push(`path: ${projectPath}`);

    if (['.ts', '.tsx', '.mts', '.cts'].includes(extname(file))) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      const inspect = (node: ts.Node): void => {
        if (ts.isIdentifier(node) && forbiddenLevelName.test(node.text)) {
          const position = source.getLineAndCharacterOfPosition(node.getStart(source));
          violations.push(
            `identifier: ${projectPath}:${position.line + 1}:${position.character + 1} ${node.text}`,
          );
        }
        ts.forEachChild(node, inspect);
      };
      inspect(source);
    }
  }

  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
    if (forbiddenLevelName.test(name) || forbiddenLevelName.test(command)) {
      violations.push(`package script: ${name}`);
    }
  }
  return violations.sort();
}

test('implementation paths and TypeScript identifiers use semantic names', () => {
  const root = process.cwd();
  const violations = findImplementationNamingViolations(root);
  assert.deepEqual(violations, [], violations.join('\n'));
});
