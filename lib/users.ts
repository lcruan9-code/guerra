import { queryOne, newId } from './db';
import type { Role } from './types';

export interface UserRow {
  id: string;
  nome: string;
  role: Role;
}

// Cria um usuário "local" (sem provedor externo). O nome é o do personagem;
// a identidade persiste no cookie de sessão do navegador.
export async function createLocalUser(nome: string): Promise<UserRow> {
  const row = await queryOne<UserRow>(
    `INSERT INTO users (id, nome) VALUES ($1, $2)
     RETURNING id, nome, role`,
    [newId(), nome],
  );
  return row!;
}
