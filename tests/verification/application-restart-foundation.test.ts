import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { loadFixture, validateFixture } from '../support/fixture-loader';
import { assertSafeTestDatabaseUrl } from '../integration/persistence/support/postgres-test-harness';

test('application restart integration refuses remote or non-test database reset targets', () => {
  assert.equal(
    assertSafeTestDatabaseUrl('postgres://tester:secret@127.0.0.1:5432/trooi_test'),
    'postgres://tester:secret@127.0.0.1:5432/trooi_test',
  );
  assert.throws(
    () => assertSafeTestDatabaseUrl('postgres://tester:secret@db.example:5432/trooi_test'),
    /Only a local trooi_test database may be reset/,
  );
  assert.throws(
    () => assertSafeTestDatabaseUrl('postgres://tester:secret@127.0.0.1:5432/trooi_dev'),
    /Only a local trooi_test database may be reset/,
  );
});

test('application restart uses schema-validated business fixtures and preserves the allocated balance comparison', () => {
  const fixture = loadFixture<Record<string, unknown>>('payment/application-restart');
  const values = fixture.values as Record<string, unknown>;
  const expected = fixture.expected as Record<string, unknown>;
  assert.notEqual(values.ownerId, values.tenantId, 'Owner and Tenant must be separate fixture principals');
  assert.equal(expected.paymentVerification, 'USER_RECORDED');
  const schema = JSON.parse(
    readFileSync('tests/fixtures/payment/application-restart.schema.json', 'utf8'),
  );
  assert.ok(Object.isFrozen(fixture));
  const missing = structuredClone(fixture);
  delete missing.expected;
  assert.throws(() => validateFixture(missing, schema), /missing field/);
  assert.throws(() => validateFixture({ ...fixture, version: 0 }, schema), /unsupported value/);
  assert.throws(() => validateFixture({ ...fixture, unexpected: 0 }, schema), /unexpected field/);
  const file = 'tests/integration/persistence/application-wiring.integration.ts';
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) return;
    // Infrastructure controls are test logic; scenario data must still come from JSON.
    if (
      ts.isNumericLiteral(node) &&
      ts.isPropertyAssignment(node.parent) &&
      ['maxPoolSize', 'connectionTimeoutMs'].includes(node.parent.name.getText(ast))
    )
      return;
    if (
      ts.isStringLiteral(node) &&
      ts.isCallExpression(node.parent) &&
      ((node.parent.expression.getText(ast) === 'runMigrations' &&
        node.parent.arguments[0] === node) ||
        (node.parent.expression.getText(ast) === 'assert.ok' && node.parent.arguments[1] === node))
    )
      return;
    if (
      [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(node.kind) &&
      ((ts.isVariableDeclaration(node.parent) && node.parent.name.getText(ast) === 'firstClosed') ||
        (ts.isBinaryExpression(node.parent) && node.parent.left.getText(ast) === 'firstClosed'))
    )
      return;
    if (ts.isStringLiteral(node)) {
      const description =
        ts.isCallExpression(node.parent) &&
        node.parent.expression.getText(ast) === 'test' &&
        node.parent.arguments[0] === node;
      const propertyName = ts.isPropertyAssignment(node.parent) && node.parent.name === node;
      if (!description && !propertyName) findings.push('inline business string');
    }
    if (
      (ts.isArrayLiteralExpression(node) &&
        node.elements.every(
          (element) => ts.isStringLiteral(element) || ts.isNumericLiteral(element),
        )) ||
      (ts.isObjectLiteralExpression(node) && node.properties.length === 0) ||
      [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(
        node.kind,
      )
    )
      findings.push('inline scenario/outcome');
    if (
      ts.isNumericLiteral(node) &&
      ((ts.isPropertyAssignment(node.parent) && node.parent.initializer === node) ||
        (ts.isCallExpression(node.parent) &&
          node.parent.expression.getText(ast).startsWith('assert.')))
    )
      findings.push('inline business number');
    if (
      ts.isCallExpression(node) &&
      /^(?:randomUUID|Math\.random|Date\.now)$/.test(node.expression.getText(ast))
    )
      findings.push('unseeded business input');
    if (
      ts.isBinaryExpression(node) &&
      [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
        node.operatorToken.kind,
      ) &&
      /F\./.test(node.left.getText(ast))
    )
      findings.push('fixture fallback');
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.deepEqual(findings, []);
  assert.match(
    source,
    /assert\.equal\(cycle\.charges\[0\]\?\.outstandingAmount, F\.expected\.initialOutstanding\)/,
  );
  assert.match(source, /assert\.deepEqual\(restartedCycle, allocatedCycle\)/);
  assert.match(source, /assert\.equal\(payment\.verification, F\.expected\.paymentVerification\)/);
  assert.match(source, /assert\.equal\(restartedPayment\.verification, F\.expected\.paymentVerification\)/);
  assert.match(source, /restartedCycle\.charges\[0\]\?\.outstandingAmount/);
  assert.match(source, /allocatedCycle\.charges\[0\]\?\.outstandingAmount/);
  assert.match(
    readFileSync('tests/support/application-restart-fixtures.ts', 'utf8'),
    /loadFixture<ApplicationRestartFixture>\(\s*'payment\/application-restart',?\s*\)/,
  );
});
