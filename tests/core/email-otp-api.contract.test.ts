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
