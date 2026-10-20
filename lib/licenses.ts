import { randomBytes } from 'crypto';
import { query, queryOne } from './db';
import { HttpError } from './auth';
import { getGuildBySlug } from './tenant';
import type { GuildDTO, LicenseDTO, LicensePlan, LicenseStatus, Reino, Servidor } from './types';

function createFormattedKey(prefix = 'WYD'): string {
  const part1 = randomBytes(2).toString('hex').toUpperCase();
  const part2 = randomBytes(2).toString('hex').toUpperCase();
  const part3 = randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${part1}-${part2}-${part3}`;
}

const PLAN_DAYS: Record<LicensePlan, number> = {
  MENSAL: 30,
  TRIMESTRAL: 90,
  SEMESTRAL: 180,
  VITALICIO: 36500,
};

interface LicenseRow {
  id: string;
  key: string;
  guild_id: string | null;
  guild_nome: string | null;
  guild_slug: string | null;
  plano: LicensePlan;
  status: LicenseStatus;
  valida_ate: Date | null;
  created_at: Date;
}

export async function generateLicenseKey(plano: LicensePlan): Promise<LicenseDTO> {
  const id = `lic-${randomBytes(8).toString('hex')}`;
  const key = createFormattedKey();

  await query(
    `INSERT INTO licenses (id, key, guild_id, plano, status, valida_ate)
     VALUES ($1, $2, NULL, $3, 'DISPONIVEL', NULL)`,
    [id, key, plano],
  );

  return {
    id,
    key,
    guild_id: null,
    plano,
    status: 'DISPONIVEL',
    valida_ate: null,
    created_at: new Date().toISOString(),
  };
}

export async function verifyLicense(key: string): Promise<LicenseDTO> {
  const cleanKey = key.trim().toUpperCase();
  const row = await queryOne<LicenseRow>(
    `SELECT l.id, l.key, l.guild_id, g.nome as guild_nome, g.slug as guild_slug,
            l.plano, l.status, l.valida_ate, l.created_at
     FROM licenses l
     LEFT JOIN guilds g ON g.id = l.guild_id
     WHERE l.key = $1`,
    [cleanKey],
  );

  if (!row) {
    throw new HttpError(404, 'Chave de licença inválida ou inexistente.');
  }

  return {
    id: row.id,
    key: row.key,
    guild_id: row.guild_id,
    guild_nome: row.guild_nome,
    guild_slug: row.guild_slug,
    plano: row.plano,
    status: row.status,
    valida_ate: row.valida_ate ? row.valida_ate.toISOString() : null,
    created_at: row.created_at.toISOString(),
  };
}

export async function activateLicense(
  key: string,
  guildData: {
    slug: string;
    nome: string;
    reino: Reino;
    servidor: Servidor;
    logo_url?: string;
  },
): Promise<{ guild: GuildDTO; license: LicenseDTO }> {
  const cleanKey = key.trim().toUpperCase();
  const lic = await queryOne<LicenseRow>(
    `SELECT id, key, guild_id, plano, status, valida_ate, created_at
     FROM licenses WHERE key = $1`,
    [cleanKey],
  );

  if (!lic) {
    throw new HttpError(404, 'Chave de licença não encontrada.');
  }
  if (lic.status !== 'DISPONIVEL') {
    throw new HttpError(400, `Esta chave já está ${lic.status.toLowerCase()}.`);
  }

  const cleanSlug = guildData.slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');

  if (cleanSlug.length < 2) {
    throw new HttpError(400, 'O slug da guilda deve ter pelo menos 2 caracteres alfanuméricos.');
  }

  const existingGuild = await getGuildBySlug(cleanSlug);
  if (existingGuild) {
    throw new HttpError(409, `A URL /${cleanSlug} já está em uso por outra guilda.`);
  }

  const guildId = `g-${cleanSlug}`;
  const days = PLAN_DAYS[lic.plano] || 30;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  // Insere a guilda
  await query(
    `INSERT INTO guilds (id, slug, nome, reino, servidor, logo_url, ativa)
     VALUES ($1, $2, $3, $4, $5, $6, true)`,
    [
      guildId,
      cleanSlug,
      guildData.nome.trim(),
      guildData.reino,
      guildData.servidor,
      guildData.logo_url || null,
    ],
  );

  // Atualiza a licença para ATIVA
  await query(
    `UPDATE licenses 
     SET guild_id = $1, status = 'ATIVA', valida_ate = $2
     WHERE id = $3`,
    [guildId, expiresAt, lic.id],
  );

  // Cria os 4 prêmios da semana padrão para essa nova guilda
  await query(
    `INSERT INTO awards (id, guild_id, key, label, ordem) VALUES
     ($1, $2, 'PONTOS', 'Pontuação da semana', 1),
     ($3, $2, 'KS_TORRE', 'Top KS na Torre', 2),
     ($4, $2, 'KEFRA', 'Top Kefra', 3),
     ($5, $2, 'PARTICIPACAO', 'Presença nas guerras', 4)
     ON CONFLICT DO NOTHING`,
    [
      `aw-${guildId}-1`,
      guildId,
      `aw-${guildId}-2`,
      `aw-${guildId}-3`,
      `aw-${guildId}-4`,
    ],
  );

  const updatedGuild: GuildDTO = {
    id: guildId,
    slug: cleanSlug,
    nome: guildData.nome.trim(),
    reino: guildData.reino,
    servidor: guildData.servidor,
    logo_url: guildData.logo_url || null,
    cor_tema: null,
    ativa: true,
    valida_ate: expiresAt.toISOString(),
    created_at: new Date().toISOString(),
  };

  const updatedLic: LicenseDTO = {
    id: lic.id,
    key: lic.key,
    guild_id: guildId,
    guild_nome: updatedGuild.nome,
    guild_slug: updatedGuild.slug,
    plano: lic.plano,
    status: 'ATIVA',
    valida_ate: expiresAt.toISOString(),
    created_at: lic.created_at.toISOString(),
  };

  return { guild: updatedGuild, license: updatedLic };
}

export async function listLicenses(): Promise<LicenseDTO[]> {
  const rows = await query<LicenseRow>(`
    SELECT l.id, l.key, l.guild_id, g.nome as guild_nome, g.slug as guild_slug,
           l.plano, l.status, l.valida_ate, l.created_at
    FROM licenses l
    LEFT JOIN guilds g ON g.id = l.guild_id
    ORDER BY l.created_at DESC
  `);

  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    guild_id: r.guild_id,
    guild_nome: r.guild_nome,
    guild_slug: r.guild_slug,
    plano: r.plano,
    status: r.status,
    valida_ate: r.valida_ate ? r.valida_ate.toISOString() : null,
    created_at: r.created_at.toISOString(),
  }));
}
