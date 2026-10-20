import { randomUUID } from 'crypto';
import { query, queryOne, getPool } from './db';
import { encrypt, decrypt } from './crypto';
import { HttpError } from './auth';
import type { AccountDTO, PublicAccountDTO, HeldAccountDTO, ColetaDTO, AccountStatus } from './types';

interface AccountRow {
  id: string;
  guild_id: string;
  personagem: string | null;
  login: string;
  senha_enc: string;
  senha_interna_enc: string;
  classe: string;
  especializacao: string;
  servidor: string;
  tier: number;
  ativo: boolean;
  status: AccountStatus;
}

function toDTO(row: AccountRow, canView: boolean): AccountDTO {
  return {
    id: row.id,
    guild_id: row.guild_id,
    personagem: row.personagem ?? '',
    login: row.login,
    classe: row.classe,
    especializacao: row.especializacao,
    servidor: row.servidor,
    tier: row.tier,
    ativo: row.ativo,
    status: row.status,
    can_view: canView,
    senha: canView ? decrypt(row.senha_enc) : null,
    senha_interna: canView ? decrypt(row.senha_interna_enc) : null,
  };
}

export async function listAccounts(guildId: string, isAdmin: boolean): Promise<AccountDTO[]> {
  const rows = await query<AccountRow>(
    `SELECT id, guild_id, personagem, login, senha_enc, senha_interna_enc, classe, especializacao,
            servidor, tier, ativo, status
     FROM accounts
     WHERE guild_id = $1
     ORDER BY tier ASC, created_at DESC`,
    [guildId],
  );
  return rows.map((r) => toDTO(r, isAdmin));
}

interface AccountInput {
  personagem: string;
  login: string;
  senha: string;
  senha_interna: string;
  classe: string;
  especializacao: string;
  servidor: string;
  tier: number;
}

function validate(input: Partial<AccountInput>) {
  const personagem = (input.personagem ?? '').trim();
  const login = (input.login ?? '').trim();
  const senha = (input.senha ?? '').trim();
  const senha_interna = (input.senha_interna ?? '').trim();
  if (!personagem || !login || !senha || !senha_interna) {
    throw new HttpError(400, 'Preencha o char, login, senha e senha interna.');
  }
  const servidor = (input.servidor ?? 'INFINITY').trim().toUpperCase();
  const tierNum = Number(input.tier);
  const tier = tierNum === 1 || tierNum === 2 || tierNum === 3 ? tierNum : 3;
  return {
    personagem,
    login,
    senha,
    senha_interna,
    classe: input.classe ?? 'FOEMA',
    especializacao: input.especializacao ?? '',
    servidor,
    tier,
  };
}

export async function createAccount(guildId: string, input: AccountInput): Promise<void> {
  const v = validate(input);
  await query(
    `INSERT INTO accounts (id, guild_id, personagem, login, senha_enc, senha_interna_enc, classe, especializacao, servidor, tier, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'DISPONIVEL')`,
    [randomUUID(), guildId, v.personagem, v.login, encrypt(v.senha), encrypt(v.senha_interna), v.classe, v.especializacao, v.servidor, v.tier],
  );
}

export async function updateAccount(guildId: string, id: string, input: AccountInput): Promise<void> {
  const v = validate(input);
  const res = await query<{ id: string }>(
    `UPDATE accounts SET personagem=$3, login=$4, senha_enc=$5, senha_interna_enc=$6, classe=$7, especializacao=$8, servidor=$9, tier=$10
     WHERE id=$1 AND guild_id=$2 RETURNING id`,
    [id, guildId, v.personagem, v.login, encrypt(v.senha), encrypt(v.senha_interna), v.classe, v.especializacao, v.servidor, v.tier],
  );
  if (res.length === 0) throw new HttpError(404, 'Conta não encontrada.');
}

export async function deleteAccount(guildId: string, id: string): Promise<void> {
  await query('DELETE FROM accounts WHERE id=$1 AND guild_id=$2', [id, guildId]);
}

export async function setAccountActive(guildId: string, id: string, ativo: boolean): Promise<void> {
  const res = await query<{ id: string }>(
    'UPDATE accounts SET ativo=$3 WHERE id=$1 AND guild_id=$2 RETURNING id',
    [id, guildId, ativo],
  );
  if (res.length === 0) throw new HttpError(404, 'Conta não encontrada.');
}

export async function releaseAccount(guildId: string, id: string): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE accounts SET status='DISPONIVEL' WHERE id=$1 AND guild_id=$2`, [id, guildId]);
    await client.query(`UPDATE coletas SET ativo=false, data_entrega=now() WHERE conta_id=$1 AND guild_id=$2 AND ativo=true`, [id, guildId]);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ---------- Fluxo público (Coleta sem login de admin) ----------

interface PublicRow {
  id: string;
  personagem: string | null;
  classe: string;
  especializacao: string;
  status: AccountStatus;
  servidor: string;
  tier: number;
  taken_by: string | null;
}

export async function listPublicAccounts(guildId: string, servidor?: string): Promise<PublicAccountDTO[]> {
  const params: unknown[] = [guildId];
  let filtro = 'WHERE a.guild_id = $1 AND a.ativo = true';
  if (servidor) {
    params.push(servidor);
    filtro += ` AND a.servidor = $${params.length}`;
  }

  const rows = await query<PublicRow>(
    `
    SELECT a.id, a.personagem, a.classe, a.especializacao, a.status, a.servidor, a.tier,
           (SELECT c.nome_pessoa FROM coletas c
              WHERE c.conta_id = a.id AND c.guild_id = a.guild_id AND c.ativo = true
              ORDER BY c.data_hora DESC LIMIT 1) AS taken_by
    FROM accounts a
    ${filtro}
    ORDER BY a.tier ASC, (a.status = 'DISPONIVEL') DESC, a.personagem, a.classe`,
    params,
  );

  return rows.map((r) => ({
    id: r.id,
    personagem: r.personagem ?? '',
    classe: r.classe,
    especializacao: r.especializacao,
    servidor: r.servidor,
    tier: r.tier,
    status: r.status,
    taken_by: r.status === 'EM_USO' ? r.taken_by : null,
  }));
}

export async function collectAccountPublic(
  guildId: string,
  id: string,
  holderId: string,
  nomePessoa: string,
  servidorOrigem: string,
): Promise<{ login: string; senha: string; senha_interna: string; classe: string; especializacao: string }> {
  const pessoa = nomePessoa.trim();
  const origem = servidorOrigem.trim();
  if (!pessoa || !origem) throw new HttpError(400, 'Informe o seu nome e o servidor de origem.');

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    // Regra: cada portador só pode estar com UMA conta por vez NESTA guilda.
    const held = await client.query(
      `SELECT 1 FROM coletas WHERE guild_id = $1 AND holder_id = $2 AND ativo = true LIMIT 1`,
      [guildId, holderId],
    );
    if (held.rows.length > 0) {
      throw new HttpError(409, 'Você já está com uma conta. Devolva-a antes de pegar outra.');
    }

    const acc = await client.query<AccountRow>(
      `SELECT id, guild_id, login, senha_enc, senha_interna_enc, classe, especializacao, status
       FROM accounts WHERE id = $1 AND guild_id = $2 FOR UPDATE`,
      [id, guildId],
    );
    const row = acc.rows[0];
    if (!row) throw new HttpError(404, 'Conta não encontrada.');
    if (row.status === 'EM_USO') throw new HttpError(409, 'Essa conta acabou de ser pega por outra pessoa.');

    await client.query(`UPDATE accounts SET status='EM_USO' WHERE id=$1 AND guild_id=$2`, [id, guildId]);
    await client.query(
      `INSERT INTO coletas (id, guild_id, conta_id, user_id, nome_pessoa, servidor_origem, ativo, conta_login, classe, especializacao, holder_id)
       VALUES ($1,$2,$3,NULL,$4,$5,true,$6,$7,$8,$9)`,
      [randomUUID(), guildId, id, pessoa, origem, row.login, row.classe, row.especializacao, holderId],
    );
    await client.query('COMMIT');

    return {
      login: row.login,
      senha: decrypt(row.senha_enc),
      senha_interna: decrypt(row.senha_interna_enc),
      classe: row.classe,
      especializacao: row.especializacao,
    };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function getHeldAccount(guildId: string, holderId: string): Promise<HeldAccountDTO | null> {
  const row = await queryOne<AccountRow>(
    `SELECT a.id, a.guild_id, a.personagem, a.login, a.senha_enc, a.senha_interna_enc, a.classe, a.especializacao, a.servidor, a.tier, a.ativo, a.status
     FROM coletas c JOIN accounts a ON a.id = c.conta_id
     WHERE c.guild_id = $1 AND c.holder_id = $2 AND c.ativo = true AND a.status = 'EM_USO'
     ORDER BY c.data_hora DESC LIMIT 1`,
    [guildId, holderId],
  );
  if (!row) return null;
  return {
    id: row.id,
    personagem: row.personagem ?? '',
    login: row.login,
    senha: decrypt(row.senha_enc),
    senha_interna: decrypt(row.senha_interna_enc),
    classe: row.classe,
    especializacao: row.especializacao,
    servidor: row.servidor,
  };
}

export async function releaseAccountPublic(guildId: string, accountId: string, holderId: string): Promise<void> {
  const chk = await query(
    `SELECT 1 FROM coletas WHERE guild_id = $1 AND conta_id = $2 AND holder_id = $3 AND ativo = true LIMIT 1`,
    [guildId, accountId, holderId],
  );
  if (chk.length === 0) throw new HttpError(403, 'Você só pode devolver a conta que pegou.');
  await releaseAccount(guildId, accountId);
}

interface ColetaRow {
  id: string;
  guild_id: string;
  conta_login: string | null;
  live_login: string | null;
  classe: string | null;
  especializacao: string | null;
  nome_pessoa: string;
  servidor_origem: string;
  data_hora: Date;
  data_entrega: Date | null;
  ativo: boolean;
}

export async function listColetas(guildId: string): Promise<ColetaDTO[]> {
  const rows = await query<ColetaRow>(
    `SELECT c.id, c.guild_id, c.conta_login, a.login AS live_login, c.classe, c.especializacao,
            c.nome_pessoa, c.servidor_origem, c.data_hora, c.data_entrega, c.ativo
     FROM coletas c
     LEFT JOIN accounts a ON a.id = c.conta_id AND a.guild_id = c.guild_id
     WHERE c.guild_id = $1
     ORDER BY c.data_hora DESC`,
    [guildId],
  );
  return rows.map((r) => ({
    id: r.id,
    guild_id: r.guild_id,
    conta_login: r.live_login ?? r.conta_login ?? '(removida)',
    classe: r.classe ?? '—',
    especializacao: r.especializacao ?? '—',
    nome_pessoa: r.nome_pessoa,
    servidor_origem: r.servidor_origem,
    data_hora: r.data_hora.toISOString(),
    data_entrega: r.data_entrega ? r.data_entrega.toISOString() : null,
    ativo: r.ativo,
  }));
}
