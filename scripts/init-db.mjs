import './load-env.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL não definida.');
  process.exit(1);
}

const sql = readFileSync(path.join(root, 'lib', 'schema.sql'), 'utf8');
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(sql);
await client.end();
console.log('Schema aplicado com sucesso.');
