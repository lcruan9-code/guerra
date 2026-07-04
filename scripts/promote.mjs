// Uso: npm run promote -- email@gmail.com
import './load-env.mjs';
import pg from 'pg';

const email = process.argv[2];
if (!email) {
  console.error('Uso: npm run promote -- <email>');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const res = await client.query("UPDATE users SET role='ADMIN' WHERE email=$1 RETURNING nome", [email]);
await client.end();

if (res.rowCount === 0) {
  console.error('Usuário não encontrado — a pessoa precisa logar com Google ao menos 1 vez antes.');
  process.exit(1);
}
console.log(`${res.rows[0].nome} agora é ADMIN (líder).`);
