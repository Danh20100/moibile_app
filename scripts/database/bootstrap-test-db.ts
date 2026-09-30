import { Client } from 'pg';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required to bootstrap test database');

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const check = await client.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'trooi_test') AS exists",
    );
    if (!check.rows[0]?.exists) {
      await client.query('CREATE DATABASE trooi_test;');
      console.log('Created trooi_test database');
    } else {
      console.log('trooi_test database already exists');
    }
  } finally {
    await client.end();
  }
}

void main();
