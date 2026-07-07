import { query, queryOne, withTransaction, newId } from './db';
import { HttpError } from './auth';
import { isValidCombo } from './wyd';
import type { CharacterDTO, SessionUser } from './types';

const MAX_CHARS = 2;

export interface CharacterInput {
  nome: string;
  classe: string;
  especializacao: string;
}

function validate(input: CharacterInput): string {
  const nome = (input.nome ?? '').trim();
  if (nome.length < 2 || nome.length > 30) {
    throw new HttpError(400, 'Nome do personagem deve ter entre 2 e 30 caracteres.');
  }
  if (!isValidCombo(input.classe, input.especializacao)) {
    throw new HttpError(400, 'Combinação de classe e especialização inválida.');
  }
  return nome;
}

// Cadastro sem login: cria o usuário (nome = personagem principal) e seu
// primeiro personagem de uma vez. Chamado quando ainda não há sessão.
export async function registerWithFirstCharacter(input: CharacterInput): Promise<SessionUser> {
  const nome = validate(input);
  return withTransaction(async (q) => {
    const users = await q<SessionUser>(
      `INSERT INTO users (id, nome) VALUES ($1, $2)
       RETURNING id, nome, role`,
      [newId(), nome],
    );
    const user = users[0];
    await q(
      `INSERT INTO characters (id, user_id, nome, classe, especializacao, principal)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [newId(), user.id, nome, input.classe, input.especializacao],
    );
    return user;
  });
}

export async function listCharacters(userId: string): Promise<CharacterDTO[]> {
  return query<CharacterDTO>(
    `SELECT id, nome, classe, especializacao, principal
     FROM characters WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  );
}

export async function createCharacter(userId: string, input: CharacterInput): Promise<CharacterDTO> {
  const nome = validate(input);
  return withTransaction(async (q) => {
    const countRows = await q<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM characters WHERE user_id = $1',
      [userId],
    );
    if (countRows[0].count >= MAX_CHARS) {
      throw new HttpError(409, 'Máximo de 2 personagens por usuário.');
    }
    const principal = countRows[0].count === 0; // primeiro personagem vira o principal
    const rows = await q<CharacterDTO>(
      `INSERT INTO characters (id, user_id, nome, classe, especializacao, principal)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nome, classe, especializacao, principal`,
      [newId(), userId, nome, input.classe, input.especializacao, principal],
    );
    return rows[0];
  });
}

export async function updateCharacter(userId: string, id: string, input: CharacterInput): Promise<CharacterDTO> {
  const nome = validate(input);
  return withTransaction(async (q) => {
    const rows = await q<CharacterDTO>(
      `UPDATE characters SET nome = $3, classe = $4, especializacao = $5
       WHERE id = $1 AND user_id = $2
       RETURNING id, nome, classe, especializacao, principal`,
      [id, userId, nome, input.classe, input.especializacao],
    );
    const row = rows[0];
    if (!row) throw new HttpError(404, 'Personagem não encontrado.');
    // O nome exibido do usuário acompanha o personagem principal.
    if (row.principal) {
      await q('UPDATE users SET nome = $2 WHERE id = $1', [userId, nome]);
    }
    return row;
  });
}
