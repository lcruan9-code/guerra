// Popula o banco com dados fictícios para teste visual.
// Idempotente: recria só os dados demo (usuários demo-*), não toca em contas reais.
// Uso: npm run seed:demo
import './load-env.mjs';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const SP = 3 * 3600 * 1000;
const DAY = 86400000;

function isoDay(d) {
  return new Date(d.getTime() - SP).toISOString().slice(0, 10);
}
function addDays(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}
function dowOf(iso) {
  return new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0=dom..6=sáb
}
function warAt(iso, hhmm = '21:00') {
  return new Date(`${iso}T${hhmm}:00-03:00`).toISOString();
}
function rnd(max) {
  return Math.floor(Math.random() * (max + 1));
}
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---- jogadores fictícios (classe/espec válidas) ----
const PLAYERS = [
  { nome: 'Kaorin', chars: [['Kaorin', 'FM', 'BLOOD'], ['KaoTK', 'TK', 'FISICO']] },
  { nome: 'Drako', chars: [['Drako', 'TK', 'FISICO']] },
  { nome: 'Selena', chars: [['Selena', 'BM', 'MAGO'], ['SelFM', 'FM', 'MAGO']] },
  { nome: 'Thorin', chars: [['Thorin', 'HT', 'FISICO']] },
  { nome: 'Mystia', chars: [['Mystia', 'FM', 'CANCEL']] },
  { nome: 'Rugnar', chars: [['Rugnar', 'TK', 'FISICO']] },
  { nome: 'Lyra', chars: [['Lyra', 'BM', 'FISICO']] },
  { nome: 'Zephyr', chars: [['Zephyr', 'FM', 'MAGO']] },
  { nome: 'Nadia', chars: [['Nadia', 'FM', 'BLOOD']] },
  { nome: 'Brutus', chars: [['Brutus', 'TK', 'FISICO'], ['BruHT', 'HT', 'FISICO']] },
  { nome: 'Ígor', chars: [['Igor', 'BM', 'MAGO']] },
  { nome: 'Vesper', chars: [['Vesper', 'HT', 'FISICO']] },
];

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// limpa dados demo anteriores (identificados por google_sub demo-*)
const { rows: oldUsers } = await client.query("SELECT id FROM users WHERE google_sub LIKE 'demo-%'");
const oldIds = oldUsers.map((r) => r.id);
if (oldIds.length) {
  await client.query('DELETE FROM confirmations WHERE user_id = ANY($1)', [oldIds]);
  await client.query('DELETE FROM characters WHERE user_id = ANY($1)', [oldIds]);
  await client.query('DELETE FROM users WHERE id = ANY($1)', [oldIds]);
}

// cria usuários + personagens demo
const players = [];
for (let i = 0; i < PLAYERS.length; i++) {
  const p = PLAYERS[i];
  const id = randomUUID();
  await client.query(
    `INSERT INTO users (id, google_sub, email, nome, role) VALUES ($1,$2,$3,$4,'MEMBRO')`,
    [id, `demo-${i + 1}`, `${p.nome.toLowerCase()}@demo.guerra`, p.nome],
  );
  const charIds = [];
  for (let c = 0; c < p.chars.length; c++) {
    const [cnome, classe, esp] = p.chars[c];
    const cid = randomUUID();
    await client.query(
      `INSERT INTO characters (id, user_id, nome, classe, especializacao, principal)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [cid, id, cnome, classe, esp, c === 0],
    );
    charIds.push(cid);
  }
  players.push({ id, nome: p.nome, charIds });
}

// ---- eventos da semana atual (seg..dom) ----
const hoje = isoDay(new Date());
const daysSinceMon = (dowOf(hoje) + 6) % 7;
const monday = addDays(hoje, -daysSinceMon);
const sunday = addDays(monday, 6);

const events = [];
for (let i = 0; i < 7; i++) {
  const dia = addDays(monday, i);
  const dow = dowOf(dia);
  const tipo = dow === 0 ? 'NOATUM' : dow === 6 ? null : 'TORRE'; // sáb sem guerra
  if (!tipo) continue;
  const id = randomUUID();
  await client.query(
    `INSERT INTO events (id, tipo, data, dia) VALUES ($1,$2,$3,$4)
     ON CONFLICT (dia) DO UPDATE SET tipo = EXCLUDED.tipo, data = EXCLUDED.data
     RETURNING id`,
    [id, tipo, warAt(dia), dia],
  );
  const { rows } = await client.query('SELECT id FROM events WHERE dia = $1', [dia]);
  events.push({ id: rows[0].id, dia, tipo, past: dia < hoje, today: dia === hoje });
}

// ---- confirmações + KS/Kefra ----
const STATUS = ['VOU', 'VOU', 'VOU', 'VOU', 'TALVEZ', 'NAO_VOU']; // maioria vai
for (const ev of events) {
  for (const pl of players) {
    // limpa confirmação demo anterior nesse evento (já removidas acima, mas garante)
    const status = pick(STATUS);
    const charId = status === 'VOU' ? pl.charIds[0] : null;
    let participou = null;
    // Guerras já ocorridas (passadas ou a de hoje) têm presença lançada,
    // para popular o painel do líder e os rankings. Futuras ficam só com a confirmação.
    if ((ev.past || ev.today) && status === 'VOU') {
      participou = Math.random() < 0.85; // maioria compareceu
    }
    await client.query(
      `INSERT INTO confirmations (id, user_id, event_id, character_id, status, participou)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, event_id) DO UPDATE
         SET status = EXCLUDED.status, character_id = EXCLUDED.character_id,
             participou = EXCLUDED.participou`,
      [randomUUID(), pl.id, ev.id, charId, status, participou],
    );
  }
  // KS da guerra: Torre até 3 (distribuídos entre quem foi), Noatum/Kefra 1.
  if (ev.past || ev.today) {
    const foram = (
      await client.query(
        "SELECT user_id FROM confirmations WHERE event_id=$1 AND status='VOU' AND participou IS TRUE",
        [ev.id],
      )
    ).rows;
    if (foram.length) {
      const cap = ev.tipo === 'NOATUM' ? 1 : 3;
      const tally = {};
      for (let k = 0; k < cap; k++) {
        const uid = pick(foram).user_id;
        tally[uid] = (tally[uid] ?? 0) + 1;
      }
      for (const [uid, n] of Object.entries(tally)) {
        await client.query('UPDATE confirmations SET ks=$3 WHERE event_id=$1 AND user_id=$2', [ev.id, uid, n]);
      }
    }
  }
}

// ---- prêmios ativos + textos ----
const AWARDS = [
  ['PONTOS', '10kk pro top pontuação'],
  ['KS_TORRE', 'Set +11 pro top KS na Torre'],
  ['KEFRA', '5kk pro top Kefra'],
  ['PARTICIPACAO', 'Poção HP x100 pra quem tem presença total'],
];
for (const [key, premio] of AWARDS) {
  await client.query('UPDATE awards SET ativo = true, premio = $2 WHERE key = $1', [key, premio]);
}

// ---- semana da premiação ----
async function setSetting(key, value) {
  await client.query(
    `INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value],
  );
}
await setSetting('semana_inicio', monday);
await setSetting('semana_fim', sunday);
await setSetting('premio_semana', 'Premiação paga sábado no CL do reino. Boa guerra a todos! ⚔️');

const stats = await client.query('SELECT COUNT(*)::int n FROM confirmations');
await client.end();

console.log('=== SEED DEMO CONCLUÍDO ===');
console.log(`Jogadores demo: ${players.length}`);
console.log(`Guerras da semana (${monday} a ${sunday}): ${events.length}`);
console.log(`  passadas: ${events.filter((e) => e.past).length} | hoje: ${events.filter((e) => e.today).length} | futuras: ${events.filter((e) => !e.past && !e.today).length}`);
console.log(`Confirmações totais no banco: ${stats.rows[0].n}`);
console.log('Prêmios ativados: PONTOS, KS_TORRE, KEFRA, PARTICIPACAO');
console.log('Senha do líder: wyd2026');
