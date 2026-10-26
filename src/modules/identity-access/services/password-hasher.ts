import { hash, verify } from '@node-rs/argon2';

const STORAGE_PATTERN =
  /^\$argon2id\$v=19\$m=[1-9][0-9]*,t=[1-9][0-9]*,p=[1-9][0-9]*\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/;

export async function hashPassword(password: string): Promise<string> {
  const encoded = (await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })).replace(/=+$/g, '');
  if (!STORAGE_PATTERN.test(encoded))
    throw new Error('argon2id encoding rejected by storage contract');
  return encoded;
}

export async function verifyPassword(encoded: string, password: string): Promise<boolean> {
  return verify(encoded, password);
}
