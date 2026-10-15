import { readFileSync } from 'node:fs';
import ts from 'typescript';

export const identityTestFiles = [
  'tests/core/login-email-normalization.test.ts',
  'tests/core/identity-test-barrier.test.ts',
  'tests/core/identity-persistence-alignment.test.ts',
  'tests/integration/persistence/identity-vnext.integration.ts',
  'tests/integration/persistence/identity-foundation.integration.ts',
  'tests/integration/persistence/support/identity-legacy-fixture.ts',
  'tests/integration/persistence/support/identity-vnext-migrations.ts',
  'tests/integration/persistence/support/identity-test-barrier.ts',
  'tests/support/fixture-loader.ts',
  'tests/support/identity-fixtures.ts',
];
const businessFields = new Set([
  'issuer',
  'subject',
  'email',
  'address',
  'normalizedEmail',
  'displayName',
  'encodedHash',
  'password_hash',
  'userId',
  'user_id',
  'organizationId',
  'tenancyId',
  'amount',
  'joinedAt',
  'verifiedAt',
  'now',
  'idToken',
  'name',
  'name_or_label',
  'operational_address_text',
  'emailRevision',
  'credentialRevision',
  'expectedRevision',
  'expectedEmailRevision',
  'emailVerified',
  'started_at',
  'ended_at',
  'end_reason',
  'left_at',
  'startedAt',
  'endedAt',
  'endReason',
  'leftAt',
  'resultCode',
  'transId',
  'responseTime',
  'payUrl',
  'deeplink',
  'merchantId',
  'remoteOrderId',
  'transactionId',
  'currency',
  'paymentMethod',
  'partnerCode',
  'accessKey',
  'secretKey',
  'ipnSecretKey',
  'referenceCode',
  'handoffAttempt',
]);
export function businessLiteralFindings(
  file: string,
  source = readFileSync(file, 'utf8'),
): string[] {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings: string[] = [];
  const add = (node: ts.Node, reason: string) =>
    findings.push(
      `${file}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}: ${reason}`,
    );
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      /^(?:randomUUID|Date\.now|Math\.random)$/.test(node.expression.getText(ast))
    )
      add(node, 'unseeded business data generation');
    if (
      [ts.SyntaxKind.NullKeyword, ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(
        node.kind,
      )
    ) {
      if (ts.isPropertyAssignment(node.parent) && businessFields.has(node.parent.name.getText(ast)))
        add(node, 'business state/claim literal must come from validated JSON');
      if (
        ts.isArrowFunction(node.parent) &&
        ts.isPropertyAssignment(node.parent.parent) &&
        node.parent.parent.name.getText(ast) === 'userExists'
      )
        add(node, 'mock business result must come from validated JSON');
    }
    if (
      ts.isStringLiteral(node) &&
      !ts.isImportDeclaration(node.parent) &&
      !ts.isLiteralTypeNode(node.parent)
    ) {
      const value = node.text;
      const sensitive =
        /(?:[^\s]+@[^\s]+\.[^\s]+|^(?:https:\/\/)?accounts\.google\.com$|^[0-9a-f]{8}-[0-9a-f-]{27}$|^\d{4}-\d{2}-\d{2}T|^\$argon2id\$)/.test(
          value,
        );
      const assigned =
        ts.isPropertyAssignment(node.parent) && businessFields.has(node.parent.name.getText(ast));
      const called =
        ts.isCallExpression(node.parent) &&
        /^(?:register|principal|googlePrincipalUserId)$/.test(node.parent.expression.getText(ast));
      if (sensitive || assigned || called)
        add(node, 'business literal must come from validated JSON');
    }
    if (
      ts.isBinaryExpression(node) &&
      [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(
        node.operatorToken.kind,
      ) &&
      /(?:fixture|F\.|G\.|L\.)/.test(node.left.getText(ast)) &&
      ts.isStringLiteral(node.right)
    )
      add(node, 'fixture must not silently fallback to literal data');
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return findings;
}
