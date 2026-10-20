import { cookies } from 'next/headers';
import { query, queryOne } from './db';
import { HttpError } from './auth';
import type { GuildDTO, Reino, Servidor } from './types';

interface GuildRow {
  id: string;
  slug: string;
  nome: string;
  reino: Reino;
  servidor: Servidor;
  logo_url: string | null;
  cor_tema: string | null;
  ativa: boolean;
  created_at: Date;
  valida_ate: Date | null;
}

export async function getGuildBySlug(slug: string): Promise<GuildDTO | null> {
  const cleanSlug = slug.toLowerCase().trim();
  const row = await queryOne<GuildRow>(
    `SELECT g.id, g.slug, g.nome, g.reino, g.servidor, g.logo_url, g.cor_tema, g.ativa, g.created_at,
            (SELECT l.valida_ate FROM licenses l 
             WHERE l.guild_id = g.id AND l.status = 'ATIVA' 
             ORDER BY l.valida_ate DESC LIMIT 1) AS valida_ate
     FROM guilds g
     WHERE g.slug = $1`,
    [cleanSlug],
  );

  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    nome: row.nome,
    reino: row.reino,
    servidor: row.servidor,
    logo_url: row.logo_url,
    cor_tema: row.cor_tema,
    ativa: row.ativa,
    valida_ate: row.valida_ate ? row.valida_ate.toISOString() : null,
    created_at: row.created_at.toISOString(),
  };
}

export async function getGuildById(id: string): Promise<GuildDTO | null> {
  const row = await queryOne<GuildRow>(
    `SELECT g.id, g.slug, g.nome, g.reino, g.servidor, g.logo_url, g.cor_tema, g.ativa, g.created_at,
            (SELECT l.valida_ate FROM licenses l 
             WHERE l.guild_id = g.id AND l.status = 'ATIVA' 
             ORDER BY l.valida_ate DESC LIMIT 1) AS valida_ate
     FROM guilds g
     WHERE g.id = $1`,
    [id],
  );

  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    nome: row.nome,
    reino: row.reino,
    servidor: row.servidor,
    logo_url: row.logo_url,
    cor_tema: row.cor_tema,
    ativa: row.ativa,
    valida_ate: row.valida_ate ? row.valida_ate.toISOString() : null,
    created_at: row.created_at.toISOString(),
  };
}

export async function requireGuild(slug: string): Promise<GuildDTO> {
  const guild = await getGuildBySlug(slug);
  if (!guild) {
    throw new HttpError(404, `Guilda "${slug}" não encontrada.`);
  }
  if (!guild.ativa) {
    throw new HttpError(403, `A guilda "${guild.nome}" está desativada.`);
  }
  return guild;
}

export async function resolveTenantFromRequest(req?: Request): Promise<GuildDTO> {
  let slug: string | null = null;
  if (req) {
    try {
      const url = new URL(req.url);
      slug = url.searchParams.get('guild') || req.headers.get('x-guild');
    } catch {
      // url inválida ou mock
    }
  }
  if (!slug) {
    try {
      const jar = await cookies();
      slug = jar.get('wyd_guild')?.value ?? null;
    } catch {
      // fora de escopo de requisição
    }
  }
  const targetSlug = slug || 'imperium';
  const guild = await getGuildBySlug(targetSlug);
  if (guild) return guild;

  const fallback = await getGuildBySlug('imperium');
  if (fallback) return fallback;

  return {
    id: 'g-imperium',
    slug: 'imperium',
    nome: 'IMPERIUM',
    reino: 'RED',
    servidor: 'ROGUE',
    logo_url: null,
    cor_tema: null,
    ativa: true,
    valida_ate: null,
    created_at: new Date().toISOString(),
  };
}

export async function listAllGuilds(): Promise<(GuildDTO & { charactersCount: number; membersCount: number })[]> {
  interface FullGuildRow extends GuildRow {
    char_count: number;
    user_count: number;
  }

  const rows = await query<FullGuildRow>(`
    SELECT g.id, g.slug, g.nome, g.reino, g.servidor, g.logo_url, g.cor_tema, g.ativa, g.created_at,
           (SELECT l.valida_ate FROM licenses l 
            WHERE l.guild_id = g.id AND l.status = 'ATIVA' 
            ORDER BY l.valida_ate DESC LIMIT 1) AS valida_ate,
           (SELECT COUNT(*)::int FROM characters c WHERE c.guild_id = g.id) AS char_count,
           (SELECT COUNT(*)::int FROM users u WHERE u.guild_id = g.id) AS user_count
    FROM guilds g
    ORDER BY g.created_at DESC
  `);

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    nome: r.nome,
    reino: r.reino,
    servidor: r.servidor,
    logo_url: r.logo_url,
    cor_tema: r.cor_tema,
    ativa: r.ativa,
    valida_ate: r.valida_ate ? r.valida_ate.toISOString() : null,
    created_at: r.created_at.toISOString(),
    charactersCount: r.char_count,
    membersCount: r.user_count,
  }));
}
