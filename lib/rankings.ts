import { query, queryOne } from './db';
import { currentWeekRange, type WeekRange } from './week';

export type AwardKey = 'PONTOS' | 'KS_TORRE' | 'KEFRA' | 'PARTICIPACAO';

export interface RankEntry {
  userId: string;
  nome: string;
  valor: number;
}

export interface AwardRow {
  key: AwardKey;
  label: string;
  ativo: boolean;
  premio: string;
  ordem: number;
}

export async function rankBy(
  key: AwardKey,
  week: WeekRange,
  limit = 20,
  guildId = 'g-imperium',
): Promise<RankEntry[]> {
  // KS Torre (soma de KS nas Torres) e Kefra (KS na Noatum) — de confirmations.ks.
  if (key === 'KS_TORRE' || key === 'KEFRA') {
    const tipo = key === 'KS_TORRE' ? 'TORRE' : 'KEFRA';
    return query<RankEntry>(
      `SELECT u.id AS "userId", u.nome, COALESCE(SUM(c.ks), 0)::int AS valor
       FROM users u
       JOIN confirmations c ON c.user_id = u.id
       JOIN events e ON e.id = c.event_id
       WHERE e.tipo = $1 AND e.dia BETWEEN $2 AND $3 AND e.cancelado = false
         AND e.guild_id = $5
       GROUP BY u.id, u.nome
       HAVING COALESCE(SUM(c.ks), 0) > 0
       ORDER BY valor DESC, u.nome ASC
       LIMIT $4`,
      [tipo, week.inicio, week.fim, limit, guildId],
    );
  }

  // Pontos e Participação: agregados sobre as confirmações da semana.
  const select =
    key === 'PONTOS'
      ? `5 * COUNT(*) FILTER (WHERE c.status = 'VOU') + 5 * COUNT(*) FILTER (WHERE c.participou IS TRUE)`
      : `COUNT(*) FILTER (WHERE c.participou IS TRUE)`;
  return query<RankEntry>(
    `SELECT u.id AS "userId", u.nome, (${select})::int AS valor
     FROM users u
     JOIN confirmations c ON c.user_id = u.id
     JOIN events e ON e.id = c.event_id
     WHERE e.dia BETWEEN $1 AND $2 AND e.cancelado = false
       AND e.guild_id = $4
     GROUP BY u.id, u.nome
     HAVING (${select}) > 0
     ORDER BY valor DESC, u.nome ASC
     LIMIT $3`,
    [week.inicio, week.fim, limit, guildId],
  );
}

export async function listAwards(guildId = 'g-imperium'): Promise<AwardRow[]> {
  return query<AwardRow>(
    'SELECT key, label, ativo, premio, ordem FROM awards WHERE guild_id = $1 ORDER BY ordem',
    [guildId],
  );
}

export interface WeekMeta {
  inicio: string;
  fim: string;
  texto: string;
}

export async function getWeekMeta(now: Date = new Date()): Promise<WeekMeta> {
  const rows = await query<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key IN ('semana_inicio','semana_fim','premio_semana')",
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const auto = currentWeekRange(now);
  return {
    inicio: map['semana_inicio'] || auto.inicio,
    fim: map['semana_fim'] || auto.fim,
    texto: map['premio_semana'] || '',
  };
}

// Painel do jogador: prêmios ativos + top de cada, pontos e posição do próprio usuário.
export interface PlayerRankingView {
  week: WeekMeta;
  awards: Array<AwardRow & { top: RankEntry[] }>;
  me: { pontos: number; posicao: number | null; total: number };
}

export async function getPlayerRankingView(
  userId: string,
  now: Date = new Date(),
  guildId = 'g-imperium',
): Promise<PlayerRankingView> {
  const week: WeekRange = await getWeekMeta(now);
  const allAwards = await listAwards(guildId);
  const active = allAwards.filter((a) => a.ativo);

  const withTops = await Promise.all(
    active.map(async (a) => ({ ...a, top: await rankBy(a.key, week, 5, guildId) })),
  );

  const pontosFull = await rankBy('PONTOS', week, 1000, guildId);
  const idx = pontosFull.findIndex((r) => r.userId === userId);
  const mine = idx >= 0 ? pontosFull[idx] : null;

  return {
    week: await getWeekMeta(now),
    awards: withTops,
    me: { pontos: mine?.valor ?? 0, posicao: idx >= 0 ? idx + 1 : null, total: pontosFull.length },
  };
}
