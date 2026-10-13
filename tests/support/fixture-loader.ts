import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';

type FixtureSchema = {
  type: 'object' | 'array' | 'string' | 'integer' | 'number' | 'boolean' | 'null';
  properties?: Record<string, FixtureSchema>;
  required?: string[];
  additionalProperties?: false;
  items?: FixtureSchema;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  enum?: unknown[];
};
export function validateFixture(value: unknown, schema: FixtureSchema, path = '$'): void {
  const reject = (reason: string): never => {
    throw new Error(`Fixture ${path}: ${reason}`);
  };
  if (schema.enum && !schema.enum.includes(value)) reject('unsupported value/version');
  switch (schema.type) {
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) reject('expected object');
      const object = value as Record<string, unknown>;
      for (const key of schema.required ?? [])
        if (!Object.hasOwn(object, key)) reject(`missing field ${key}`);
      for (const [key, child] of Object.entries(object)) {
        const definition = schema.properties?.[key];
        if (!definition) reject(`unexpected field ${key}`);
        validateFixture(child, definition!, `${path}.${key}`);
      }
      break;
    }
    case 'array':
      if (!Array.isArray(value)) reject('expected array');
      if (
        (value as unknown[]).length < (schema.minItems ?? 0) ||
        (value as unknown[]).length > (schema.maxItems ?? Infinity)
      )
        reject('invalid array length');
      for (const [index, child] of (value as unknown[]).entries()) {
        if (!schema.items) reject('missing item schema');
        validateFixture(child, schema.items!, `${path}[${index}]`);
      }
      break;
    case 'string':
      if (typeof value !== 'string' || value.length < (schema.minLength ?? 0))
        reject('expected nonempty string');
      break;
    case 'boolean':
      if (typeof value !== 'boolean') reject('expected boolean');
      break;
    case 'null':
      if (value !== null) reject('expected null');
      break;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) reject('expected finite number');
      break;
    case 'integer':
      if (!Number.isInteger(value)) reject('expected integer');
      break;
    default:
      reject('unsupported schema type');
  }
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export function loadFixture<T>(name: string): T {
  const root = resolve('tests/fixtures');
  const file = resolve(root, `${name}.json`);
  if (!file.startsWith(root + sep)) throw new Error('Fixture path must stay under tests/fixtures');
  const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const schema: FixtureSchema = JSON.parse(
    readFileSync(file.replace(/\.json$/, '.schema.json'), 'utf8'),
  );
  validateFixture(value, schema, name);
  return freeze(value as T);
}
