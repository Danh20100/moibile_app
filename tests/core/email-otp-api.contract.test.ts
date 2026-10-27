import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { validate } from 'class-validator';
import { HTTP_CODE_METADATA, HEADERS_METADATA } from '@nestjs/common/constants';
import { IdentityAccessController } from '../../src/modules/identity-access/controllers/identity-access.controller';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator';
import { EmailChangeRequestDto, EmailChangeVerifyDto, EmailOtpRequestDto, EmailOtpVerifyDto, PasswordResetRequestDto, PasswordResetVerifyDto } from '../../src/modules/identity-access/dto';

for (const Dto of [EmailOtpVerifyDto, PasswordResetVerifyDto, EmailChangeVerifyDto]) {
  test(`${Dto.name} rejects malformed challenge UUIDs before PostgreSQL`, async () => {
    const dto = Object.assign(new Dto(), { otpChallengeId: 'not-a-uuid', code: '123456', password: 'valid-password' });
    assert.ok((await validate(dto)).some(error => error.property === 'otpChallengeId'));
  });
}

for (const Dto of [EmailOtpRequestDto, PasswordResetRequestDto, EmailChangeRequestDto]) {
  test(`${Dto.name} bounds the destination before normalization and storage`, async () => {
    const dto = Object.assign(new Dto(), { email: `${'a'.repeat(255)}@example.test`, password: 'valid-password' });
    assert.ok((await validate(dto)).some(error => error.property === 'email'));
  });
}

for (const method of ['requestEmailRegistrationOtp', 'verifyEmailRegistrationOtp', 'requestPasswordReset', 'verifyPasswordReset', 'requestEmailChangeOtp', 'verifyEmailChangeOtp'] as const) {
  test(`${method} has the documented 200 status and prohibits response caching`, () => {
    const handler = IdentityAccessController.prototype[method];
    assert.equal(Reflect.getMetadata(HTTP_CODE_METADATA, handler), 200);
    assert.ok((Reflect.getMetadata(HEADERS_METADATA, handler) as Array<{ name: string; value: string }> | undefined)
      ?.some(header => header.name.toLowerCase() === 'cache-control' && header.value === 'no-store'));
  });
}

for (const method of ['requestEmailChangeOtp', 'verifyEmailChangeOtp'] as const) {
  test(`${method} remains protected by the current authenticated User session`, () => {
    assert.notEqual(Reflect.getMetadata(IS_PUBLIC_KEY, IdentityAccessController.prototype[method]), true);
  });
}

const otpPaths = [
  '/identity-access/register/email/otp/request', '/identity-access/register/email/otp/verify',
  '/identity-access/password/reset/request', '/identity-access/password/reset/verify',
  '/identity-access/profile/email/otp/request', '/identity-access/profile/email/otp/verify',
];
for (const path of otpPaths) {
  test(`published OpenAPI contains the current OTP response contract for ${path}`, async () => {
    const { readFileSync } = await import('node:fs');
    const document = JSON.parse(readFileSync('docs/api/openapi.json', 'utf8'));
    const operation = document.paths[path]?.post;
    assert.ok(operation, 'OTP route must be present in the published API contract');
    assert.ok(operation.responses['200']);
    assert.ok(operation.requestBody?.content?.['application/json']?.schema);
  });
}

for (const Dto of [EmailOtpVerifyDto, PasswordResetVerifyDto, EmailChangeVerifyDto]) {
  test(`${Dto.name} rejects a seventh trailing newline in the six-digit code`, async () => {
    const dto = Object.assign(new Dto(), {
      otpChallengeId: 'b43d6010-f40d-4a34-84af-3aba98cecf20', code: '123456\n', password: 'valid-password',
    });
    assert.ok((await validate(dto)).some(error => error.property === 'code'));
  });
}


test('email-change response documents both ordered OTP stages', async () => {
  const { readFileSync } = await import('node:fs');
  const document = JSON.parse(readFileSync('docs/api/openapi.json', 'utf8'));
  const response = document.paths['/identity-access/profile/email/otp/verify'].post.responses['200'];
  assert.equal(response.content['application/json'].schema.$ref, '#/components/schemas/EmailChangeAcceptedDto');
  const schema = document.components.schemas.EmailChangeAcceptedDto;
  assert.deepEqual(schema.properties.nextStep.enum, ['NEW_EMAIL']);
  assert.ok(schema.properties.resendAvailableAt);
  assert.ok(schema.properties.oldEmailNoticeSent);
});

for (const method of [
  'issueAuthChallenge', 'authenticateWithGoogle', 'registerWithGoogle',
  'requestEmailRegistrationOtp', 'verifyEmailRegistrationOtp', 'authenticatePassword',
  'requestPasswordReset', 'verifyPasswordReset', 'refreshSession',
] as const) {
  test(`${method} is a public identity entry point`, () => {
    assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, IdentityAccessController.prototype[method]), true);
  });
}

for (const method of ['authenticateWithGoogle', 'authenticatePassword', 'refreshSession'] as const) {
  test(`${method} returns the documented HTTP 200 session contract`, () => {
    assert.equal(Reflect.getMetadata(HTTP_CODE_METADATA, IdentityAccessController.prototype[method]), 200);
  });
}

const authContractPaths = [
  ['/identity-access/auth/challenge', 'post', true, 'AuthChallengeRequestDto', 'IdentityChallengeDto', '201'],
  ['/identity-access/auth/google', 'post', true, 'GoogleSessionRequestDto', 'IdentitySessionDto', '200'],
  ['/identity-access/register/google', 'post', true, 'GoogleSessionRequestDto', 'IdentitySessionDto', '201'],
  ['/identity-access/register/email/otp/request', 'post', true, 'EmailOtpRequestDto', 'EmailOtpChallengeDto', '200'],
  ['/identity-access/register/email/otp/verify', 'post', true, 'EmailOtpVerifyDto', 'IdentitySessionDto', '200'],
  ['/identity-access/auth/password', 'post', true, 'PasswordLoginDto', 'IdentitySessionDto', '200'],
  ['/identity-access/password/reset/request', 'post', true, 'PasswordResetRequestDto', 'EmailOtpChallengeDto', '200'],
  ['/identity-access/password/reset/verify', 'post', true, 'PasswordResetVerifyDto', 'PasswordResetAcceptedDto', '200'],
  ['/identity-access/auth/refresh', 'post', true, 'RefreshSessionRequestDto', 'IdentitySessionDto', '200'],
  ['/identity-access/auth/logout', 'post', false, null, null, '201'],
  ['/identity-access/auth/revoke-all', 'post', false, null, null, '201'],
  ['/identity-access/reauth/organization-create/challenge', 'post', false, null, 'ReauthenticationChallengeDto', '201'],
  ['/identity-access/reauth/organization-create/proof', 'post', false, 'ReauthenticationProofDto', 'ReauthenticationResponseDto', '201'],
  ['/identity-access/reauth/organization-create/password', 'post', false, 'PasswordReauthenticationDto', 'ReauthenticationResponseDto', '201'],
  ['/identity-access/reauth/organization-create/pin', 'post', false, 'PinReauthenticationDto', 'ReauthenticationResponseDto', '201'],
  ['/identity-access/security/account', 'get', false, null, null, '200'],
  ['/identity-access/security/password/setup/challenge', 'post', false, null, 'ReauthenticationChallengeDto', '201'],
  ['/identity-access/security/password/setup', 'post', false, 'InitialPasswordSetupDto', null, '201'],
  ['/identity-access/security/password', 'patch', false, 'PasswordChangeDto', null, '200'],
  ['/identity-access/security/pin', 'get', false, null, null, '200'],
  ['/identity-access/security/pin', 'post', false, 'SecurityPinSetupDto', null, '201'],
  ['/identity-access/security/pin', 'patch', false, 'SecurityPinChangeDto', null, '200'],
] as const;

for (const [path, method, isPublic, requestSchema, responseSchema, status] of authContractPaths) {
  test(`OpenAPI matches Android identity contract for ${method.toUpperCase()} ${path}`, async () => {
    const { readFileSync } = await import('node:fs');
    const document = JSON.parse(readFileSync('docs/api/openapi.json', 'utf8'));
    const operation = document.paths[path]?.[method];
    assert.ok(operation, 'identity route must be present in the published API contract');
    assert.deepEqual(operation.security, isPublic ? [] : [{ bearer: [] }]);
    if (requestSchema) {
      assert.equal(operation.requestBody?.content?.['application/json']?.schema?.$ref, `#/components/schemas/${requestSchema}`);
    } else {
      assert.equal(operation.requestBody, undefined);
    }
    const response = operation.responses[status];
    assert.ok(response, `expected HTTP ${status} response`);
    if (responseSchema) {
      assert.equal(response.content?.['application/json']?.schema?.$ref, `#/components/schemas/${responseSchema}`);
    } else {
      assert.equal(response.content?.['application/json']?.schema?.type, 'object');
    }
  });
}

test('runtime OpenAPI public-path policy includes every public Android auth entry point', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync('src/openapi.ts', 'utf8');
  for (const [path, method, isPublic] of authContractPaths) {
    if (!isPublic) continue;
    assert.ok(source.includes(`{ path: '${path}', method: '${method}' }`), `${path} must be explicitly public in runtime OpenAPI policy`);
  }
}
