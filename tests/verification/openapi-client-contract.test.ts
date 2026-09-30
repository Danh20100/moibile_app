/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

interface OpenApiDoc {
  openapi: string;
  paths: Record<string, Record<string, {
    summary?: string;
    security?: Array<Record<string, string[]>>;
    requestBody?: {
      content?: Record<string, { schema?: { $ref?: string; type?: string } }>;
    };
    responses?: Record<string, {
      content?: Record<string, {
        schema?: { $ref?: string; type?: string; items?: { $ref?: string } };
      }>;
    }>;
  }>>;
  components?: {
    securitySchemes?: Record<string, unknown>;
    schemas?: Record<string, unknown>;
  };
}

function loadOpenApi(): OpenApiDoc {
  const file = resolve(process.cwd(), 'docs/api/openapi.json');
  return JSON.parse(readFileSync(file, 'utf8')) as OpenApiDoc;
}

test('openapi: components.schemas is populated with named schemas', () => {
  const doc = loadOpenApi();
  const schemas = doc.components?.schemas;
  assert.ok(schemas, 'components.schemas must exist');
  if (!schemas) {
    return;
  }
  const keys = Object.keys(schemas);
  assert.ok(keys.length >= 25, `Expected at least 25 schemas, got ${keys.length}`);

  // Critical schemas required by Android vertical slices
  const requiredSchemas = [
    'HealthStatusDto',
    'VerifyGoogleTokenDto',
    'VerifiedPrincipalDto',
    'SessionContextDto',
    'CreateOrganizationDto',
    'OrganizationProfileDto',
    'CreatePropertyDto',
    'PropertyProfileDto',
    'CreateRoomDto',
    'RoomProfileDto',
    'CreateListingDto',
    'ListingProfileDto',
    'CreateInquiryDto',
    'InquiryDto',
    'TenancyProfileDto',
    'TenancyParticipantDto',
    'TenancyTermsDto',
    'TenancyNoticeDto',
    'BillingCycleDto',
    'PaymentDto',
    'ReceiptRecordDto',
    'IncidentTicketDto',
  ];

  for (const schemaName of requiredSchemas) {
    assert.ok(schemas[schemaName], `Missing schema: ${schemaName}`);
  }
});

test('openapi: bearer security schemes defined and applied to protected operations', () => {
  const doc = loadOpenApi();
  assert.ok(doc.components?.securitySchemes?.bearer, 'Bearer security scheme must exist');

  // Public operations must have empty security: []
  const publicOps = [
    { path: '/health', method: 'get' },
    { path: '/listings/public', method: 'get' },
    { path: '/identity-access/auth/google', method: 'post' },
  ];

  for (const { path, method } of publicOps) {
    const op = doc.paths[path]?.[method];
    assert.ok(op, `Path ${method.toUpperCase()} ${path} must exist`);
    assert.deepEqual(op.security, [], `Public endpoint ${path} must declare security: []`);
  }

  // Protected operations must have bearer security
  const protectedOps = [
    { path: '/identity-access/me', method: 'get' },
    { path: '/organizations', method: 'get' },
    { path: '/organizations', method: 'post' },
    { path: '/properties', method: 'get' },
    { path: '/rooms', method: 'get' },
    { path: '/inquiries', method: 'post' },
    { path: '/finance/cycles', method: 'get' },
    { path: '/receipts', method: 'get' },
    { path: '/incidents', method: 'get' },
  ];

  for (const { path, method } of protectedOps) {
    const op = doc.paths[path]?.[method];
    assert.ok(op, `Path ${method.toUpperCase()} ${path} must exist`);
    assert.ok(
      Array.isArray(op.security) &&
        op.security.some((s) => 'bearer' in s),
      `Protected endpoint ${method.toUpperCase()} ${path} must have bearer security`,
    );
  }
});

test('openapi: vertical slices request and response schemas are fully specified', () => {
  const doc = loadOpenApi();

  // POST /identity-access/auth/google
  const authOp = doc.paths['/identity-access/auth/google']?.post;
  assert.equal(
    authOp?.requestBody?.content?.['application/json']?.schema?.$ref,
    '#/components/schemas/VerifyGoogleTokenDto',
  );
  assert.equal(
    authOp?.responses?.['200']?.content?.['application/json']?.schema?.$ref,
    '#/components/schemas/VerifiedPrincipalDto',
  );

  // GET /identity-access/me
  const meOp = doc.paths['/identity-access/me']?.get;
  assert.equal(
    meOp?.responses?.['200']?.content?.['application/json']?.schema?.$ref,
    '#/components/schemas/SessionContextDto',
  );

  // GET /listings/public
  const publicListingsOp = doc.paths['/listings/public']?.get;
  assert.equal(
    publicListingsOp?.responses?.['200']?.content?.['application/json']?.schema?.items?.$ref,
    '#/components/schemas/ListingProfileDto',
  );

  // POST /inquiries
  const inquiryOp = doc.paths['/inquiries']?.post;
  assert.equal(
    inquiryOp?.requestBody?.content?.['application/json']?.schema?.$ref,
    '#/components/schemas/CreateInquiryDto',
  );
  assert.equal(
    inquiryOp?.responses?.['201']?.content?.['application/json']?.schema?.$ref,
    '#/components/schemas/InquiryDto',
  );
});
