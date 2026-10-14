import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import { loadFixture, validateFixture } from '../support/fixture-loader';
import { verificationFixture } from '../support/verification-fixtures';

const componentFiles = [
  'tests/core/manual-verification.workflow.test.ts',
  'tests/integration/infrastructure/compreface-verifier.test.ts',
  'tests/integration/infrastructure/private-s3-object-storage.test.ts',
];
const implementationFiles = [
  'src/modules/identity-verification/domain/manual-verification.workflow.ts',
  'src/integrations/compreface/compreface-verifier.ts',
  'src/infrastructure/object-storage/private-s3-object-storage.adapter.ts',
];
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name).replaceAll('\\', '/');
    return entry.isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

test('verification fixture is schema-validated, versioned, immutable and has no silent fallback', () => {
  const schema = JSON.parse(
    readFileSync('tests/fixtures/verification/foundation.schema.json', 'utf8'),
  );
  assert.equal(verificationFixture.version, 1);
  assert.ok(verificationFixture.provenance.length);
  assert.ok(Object.isFrozen(verificationFixture));
  assert.ok(Object.isFrozen(verificationFixture.face.success.result));
  const missing = structuredClone(verificationFixture) as Partial<typeof verificationFixture>;
  delete missing.manual;
  assert.throws(() => validateFixture(missing, schema), /missing field/);
  const unknownVersion = { ...verificationFixture, version: verificationFixture.version + 1 };
  assert.throws(() => validateFixture(unknownVersion, schema), /unsupported value/);
  const extra = { ...verificationFixture, unexpected: verificationFixture.version };
  assert.throws(() => validateFixture(extra, schema), /unexpected field/);
  const malformed = structuredClone(verificationFixture);
  (malformed.face.enabled as unknown as Record<string, unknown>).timeoutMs =
    malformed.face.invalidJson;
  assert.throws(() => validateFixture(malformed, schema), /expected integer/);
  assert.throws(() => loadFixture('verification/missing-fixture'), /ENOENT/);
  assert.throws(() => loadFixture('../outside'), /must stay under/);
});

test('verification component business inputs and simulated outcomes come from validated JSON', () => {
  const fields = new Set([
    'attemptId',
    'subjectUserId',
    'reviewerId',
    'reviewer',
    'state',
    'revision',
    'similarity',
    'comparedAt',
    'decidedAt',
    'provider',
    'origin',
    'endpoint',
    'apiKey',
    'accessKey',
    'secretKey',
    'bucket',
    'contentType',
    'faceCount',
    'matches',
    'result',
    'face_matches',
  ]);
  const findings: string[] = [];
  for (const file of componentFiles) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /verification-fixtures/);
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node): void {
      if (ts.isPropertyAssignment(node) && fields.has(node.name.getText(ast))) {
        const value = node.initializer;
        if (
          ts.isStringLiteral(value) ||
          ts.isNumericLiteral(value) ||
          ts.isArrayLiteralExpression(value) ||
          ts.isObjectLiteralExpression(value) ||
          value.kind === ts.SyntaxKind.TrueKeyword ||
          value.kind === ts.SyntaxKind.FalseKeyword
        ) {
          findings.push(`${file}: inline ${node.name.getText(ast)}`);
        }
      }
      if (
        ts.isCallExpression(node) &&
        /^(?:randomUUID|Math\.random|Date\.now)$/.test(node.expression.getText(ast))
      )
        findings.push(`${file}: unseeded input`);
      if (
        ts.isBinaryExpression(node) &&
        [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
          node.operatorToken.kind,
        ) &&
        /(?:verificationFixture|F\.)/.test(node.left.getText(ast))
      )
        findings.push(`${file}: fixture fallback`);
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  assert.deepEqual(findings, []);
  assert.match(
    readFileSync('tests/support/verification-fixtures.ts', 'utf8'),
    /loadFixture<FoundationFixture>\('verification\/foundation'\)/,
  );
});

test('verification primitives stay inactive with no production callers, HTTP routes or automatic verification result', () => {
  const marker =
    /(?:compreface-verifier|manual-verification\.workflow|private-s3-object-storage\.adapter|CompreFaceVerifier|startManualReview|submitVerification|decideManualReview|createObjectStorageAdapter|PrivateS3ObjectStorageAdapter)/;
  for (const file of sourceFiles('src')) {
    const source = readFileSync(file, 'utf8');
    if (implementationFiles.includes(file)) {
      assert.doesNotMatch(source, /@(?:Controller|Module|Get|Post|Put|Delete|Patch)\b/);
    } else {
      // Messaging and Listing may import shared private storage; verification workflows remain inactive.
      const forbidden =
        file === 'src/modules/messaging/messaging.module.ts' ||
        file === 'src/infrastructure/object-storage/object-storage.module.ts'
          ? /(?:compreface-verifier|manual-verification\.workflow|CompreFaceVerifier|startManualReview|submitVerification|decideManualReview)/
          : marker;
      assert.doesNotMatch(source, forbidden, `${file} must not activate KYC primitives`);
    }
  }
  const face = readFileSync(implementationFiles[1], 'utf8');
  assert.doesNotMatch(face, /\bVERIFIED\b|\bverified\s*:/);
  assert.equal(Object.hasOwn(verificationFixture.face.expected, 'verified'), false);
});

test('finance scenarios and legacy harness reference data use validated JSON without inline business fallbacks', () => {
  const file = 'tests/core/finance.behavior.test.ts';
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isStringLiteral(node)) {
      const description =
        ts.isCallExpression(node.parent) &&
        node.parent.expression.getText(ast) === 'test' &&
        node.parent.arguments[0] === node;
      const fieldName =
        ts.isBinaryExpression(node.parent) &&
        node.parent.operatorToken.kind === ts.SyntaxKind.InKeyword;
      const propertyName = ts.isPropertyAssignment(node.parent) && node.parent.name === node;
      if (!description && !fieldName && !propertyName)
        findings.push(`${file}: inline business string`);
    }
    if (
      ts.isArrayLiteralExpression(node) ||
      (ts.isObjectLiteralExpression(node) && node.properties.length === 0) ||
      [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(
        node.kind,
      )
    )
      findings.push(`${file}: inline scenario/outcome`);
    if (
      ts.isNumericLiteral(node) &&
      ((ts.isPropertyAssignment(node.parent) && node.parent.initializer === node) ||
        (ts.isCallExpression(node.parent) &&
          node.parent.expression.getText(ast).startsWith('assert.')))
    )
      findings.push(`${file}: inline business number`);
    if (
      ts.isBinaryExpression(node) &&
      [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
        node.operatorToken.kind,
      ) &&
      /F\./.test(node.left.getText(ast))
    )
      findings.push(`${file}: fixture fallback`);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.deepEqual(findings, []);
  const harnessFile = 'tests/core/support/in-memory-transaction-manager.ts';
  const harness = readFileSync(harnessFile, 'utf8');
  const harnessAst = ts.createSourceFile(harnessFile, harness, ts.ScriptTarget.Latest, true);
  const references: string[] = [];
  function inspect(node: ts.Node): void {
    if (
      ts.isPropertyAssignment(node) &&
      ['findTenancy', 'findTermsById'].includes(node.name.getText(harnessAst))
    ) {
      const body = node.initializer.getText(harnessAst);
      assert.match(body, /coreReferencesFixture\./);
      // Scope only these fixture lookups; repository algorithms keep their protocol enums and arithmetic constants.
      function rejectInline(child: ts.Node): void {
        assert.equal(
          ts.isStringLiteral(child) ||
            ts.isNumericLiteral(child) ||
            ts.isObjectLiteralExpression(child) ||
            ts.isArrayLiteralExpression(child),
          false,
          `${harnessFile}: inline reference dataset`,
        );
        ts.forEachChild(child, rejectInline);
      }
      rejectInline(node.initializer);
      references.push(node.name.getText(harnessAst));
    }
    ts.forEachChild(node, inspect);
  }
  inspect(harnessAst);
  assert.equal(references.length, 2);
  assert.match(
    readFileSync('tests/support/finance-fixtures.ts', 'utf8'),
    /loadFixture<FinanceFixture>\('payment\/finance-behavior'\)/,
  );
  assert.match(
    readFileSync('tests/support/core-reference-fixtures.ts', 'utf8'),
    /loadFixture<CoreReferencesFixture>\('rental\/core-references'\)/,
  );
  for (const name of ['payment/finance-behavior', 'rental/core-references']) {
    const fixture = loadFixture<Record<string, unknown>>(name);
    const schema = JSON.parse(readFileSync(`tests/fixtures/${name}.schema.json`, 'utf8'));
    assert.ok(Object.isFrozen(fixture));
    assert.throws(() => validateFixture({ ...fixture, version: 0 }, schema), /unsupported value/);
    assert.throws(() => validateFixture({ ...fixture, unexpected: 0 }, schema), /unexpected field/);
    const missing = structuredClone(fixture);
    delete missing.provenance;
    assert.throws(() => validateFixture(missing, schema), /missing field/);
  }
});
