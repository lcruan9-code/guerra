# SET do personagem & Gear Score — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a cada personagem um "set" (equipamento) montável numa tela estilo WYD e derivar um gear score 0–48, com ranking de força pro líder.

**Architecture:** Equipamento vive em `characters.equipment JSONB`. O score é derivado por uma função pura (`lib/gear.ts`, testada com vitest), sem coluna de score. Backend estende `characters.ts`/`admin.ts` + 2 rotas novas. Frontend: componente `EquipmentGrid` (grade + bottom-sheets) aberto pelo botão SET no sheet "Meus personagens", e aba "Força" no `AdminPanel`.

**Tech Stack:** Next.js 16 (App Router, TS) · React 19 · PostgreSQL (`pg`, JSONB) · vitest. Sem libs novas.

## Global Constraints

- **Domínio travado (16 slots, gear score 0–48).** Regras exatas: pet lvl120=1/lvl150=2; refino set/arma/escudo/cythera +13/+14/+15 = 1/2/3 (abaixo=0); capa refino +0/+9/+11 = 0/1/2; runa não tem=0 / +1–5=1 / +6–9=2; add sux/semi/full = 1/2/3; tipo (anel/brinco/cinto) T1/T2 = 1/2; cythera e capa somam refino **+** add. Slot vazio = 0.
- **Sem coluna de score** — sempre derivado (segue a filosofia dos pontos de guerra).
- **`lib/gear.ts` deve ser puro** — importa só `type` de `./types`; NUNCA importa `./auth`/`next/headers` (senão quebra o vitest).
- **Imutabilidade** — updates de estado/objeto sempre criam cópia nova (nunca mutam).
- **Validação no servidor** — `parseEquipment` valida faixas/enums; só o dono edita seu personagem; ranking só via `requireLeader`.
- **Migração idempotente** — toda mudança de schema em `lib/schema.sql` via `ADD COLUMN IF NOT EXISTS` (aplicada por `npm run db:init`).
- **Fidelidade visual** — a tela do SET deve ficar bem próxima do print da janela de Equipamento do WYD (referência: `docs/superpowers/specs/assets/equip-ref.png`).
- Estilo de teste: `import { describe, expect, test } from 'vitest'`, importando de `../lib/...`.

---

### Task 1: Tipos de domínio + motor de pontuação (`lib/gear.ts`)

Núcleo puro e testável. É a fundação de tudo.

**Files:**
- Modify: `lib/types.ts` (adiciona `AddTier`, `Tipo`, `Equipment`; estende `CharacterDTO`)
- Create: `lib/gear.ts`
- Test: `tests/gear.test.ts`

**Interfaces:**
- Produces:
  - `type AddTier = 'SUX' | 'SEMI' | 'FULL'`, `type Tipo = 'T1' | 'T2'`, `interface Equipment`
  - `gearScore(eq: Equipment | null | undefined): number`
  - `slotBreakdown(eq: Equipment | null | undefined): SlotScore[]` onde `interface SlotScore { key: string; label: string; pontos: number }`
  - `parseEquipment(input: unknown): Equipment` (lança `Error` com mensagem em payload inválido)
  - `const GEAR_MAX: number` (= 48, derivado)

- [ ] **Step 1: Adicionar tipos em `lib/types.ts`**

No topo do arquivo (após os `type` existentes) adicione:

```ts
export type AddTier = 'SUX' | 'SEMI' | 'FULL';
export type Tipo = 'T1' | 'T2';

export interface Equipment {
  pet?: 120 | 150 | null;
  cythera?: { refino?: number | null; add?: AddTier | null };
  armadura?: { refino?: number | null };
  calca?: { refino?: number | null };
  luvas?: { refino?: number | null };
  botas?: { refino?: number | null };
  arma?: { refino?: number | null };
  escudo?: { refino?: number | null };
  capa?: { refino?: number | null; add?: AddTier | null };
  runa?: { refino?: number | null };
  amuletos?: (AddTier | null)[];
  anel?: Tipo | null;
  brinco?: Tipo | null;
  cinto?: Tipo | null;
}
```

E estenda `CharacterDTO` (campos opcionais para não quebrar create/update que não os selecionam):

```ts
export interface CharacterDTO {
  id: string;
  nome: string;
  classe: Classe;
  especializacao: Especializacao;
  principal: boolean;
  equipment?: Equipment | null;
  score?: number;
}
```

- [ ] **Step 2: Escrever o teste que falha (`tests/gear.test.ts`)**

```ts
import { describe, expect, test } from 'vitest';
import { gearScore, slotBreakdown, parseEquipment, GEAR_MAX } from '../lib/gear';
import type { Equipment } from '../lib/types';

const MAX: Equipment = {
  pet: 150,
  cythera: { refino: 15, add: 'FULL' },
  armadura: { refino: 15 }, calca: { refino: 15 }, luvas: { refino: 15 }, botas: { refino: 15 },
  arma: { refino: 15 }, escudo: { refino: 15 },
  capa: { refino: 11, add: 'FULL' },
  runa: { refino: 9 },
  amuletos: ['FULL', 'FULL', 'FULL'],
  anel: 'T2', brinco: 'T2', cinto: 'T2',
};

describe('gear score', () => {
  test('set vazio ou null = 0', () => {
    expect(gearScore(null)).toBe(0);
    expect(gearScore({})).toBe(0);
  });

  test('set máximo = 48 e GEAR_MAX = 48', () => {
    expect(gearScore(MAX)).toBe(48);
    expect(GEAR_MAX).toBe(48);
  });

  test('refino de set só pontua a partir do +13', () => {
    expect(gearScore({ arma: { refino: 12 } })).toBe(0);
    expect(gearScore({ arma: { refino: 13 } })).toBe(1);
    expect(gearScore({ arma: { refino: 14 } })).toBe(2);
    expect(gearScore({ arma: { refino: 15 } })).toBe(3);
  });

  test('capa soma refino (+0/+9/+11) e add', () => {
    expect(gearScore({ capa: { refino: 0 } })).toBe(0);
    expect(gearScore({ capa: { refino: 9 } })).toBe(1);
    expect(gearScore({ capa: { refino: 11 } })).toBe(2);
    expect(gearScore({ capa: { refino: 11, add: 'FULL' } })).toBe(5);
  });

  test('runa: fronteira +5 vs +6', () => {
    expect(gearScore({ runa: { refino: null } })).toBe(0);
    expect(gearScore({ runa: { refino: 5 } })).toBe(1);
    expect(gearScore({ runa: { refino: 6 } })).toBe(2);
    expect(gearScore({ runa: { refino: 9 } })).toBe(2);
  });

  test('cythera soma add + refino', () => {
    expect(gearScore({ cythera: { refino: 15, add: 'FULL' } })).toBe(6);
    expect(gearScore({ cythera: { refino: 13, add: 'SUX' } })).toBe(2);
  });

  test('amuletos: cada um pontua por add', () => {
    expect(gearScore({ amuletos: ['SUX', 'SEMI', 'FULL'] })).toBe(6);
    expect(gearScore({ amuletos: ['FULL'] })).toBe(3);
  });

  test('anel/brinco/cinto por tipo', () => {
    expect(gearScore({ anel: 'T1', brinco: 'T2', cinto: null })).toBe(3);
  });

  test('pet só lvl 120/150', () => {
    expect(gearScore({ pet: 120 })).toBe(1);
    expect(gearScore({ pet: 150 })).toBe(2);
    expect(gearScore({ pet: null })).toBe(0);
  });

  test('slotBreakdown soma igual ao total', () => {
    const total = slotBreakdown(MAX).reduce((s, x) => s + x.pontos, 0);
    expect(total).toBe(gearScore(MAX));
    expect(slotBreakdown(MAX)).toHaveLength(16);
  });
});

describe('parseEquipment', () => {
  test('aceita payload válido e normaliza', () => {
    const eq = parseEquipment({ arma: { refino: 15 }, anel: 'T2', amuletos: ['FULL'] });
    expect(eq.arma?.refino).toBe(15);
    expect(eq.anel).toBe('T2');
  });
  test('rejeita refino fora de faixa', () => {
    expect(() => parseEquipment({ arma: { refino: 99 } })).toThrow();
  });
  test('rejeita add/tipo desconhecido', () => {
    expect(() => parseEquipment({ anel: 'T9' })).toThrow();
    expect(() => parseEquipment({ capa: { add: 'MEGA' } })).toThrow();
  });
  test('rejeita mais de 3 amuletos', () => {
    expect(() => parseEquipment({ amuletos: ['SUX', 'SUX', 'SUX', 'SUX'] })).toThrow();
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npm test -- gear`
Expected: FAIL — `Failed to resolve import "../lib/gear"` (módulo ainda não existe).

- [ ] **Step 4: Implementar `lib/gear.ts`**

```ts
import type { AddTier, Equipment, Tipo } from './types';

// ── Tabelas de pontos ────────────────────────────────────────────
const ADD_PTS: Record<AddTier, number> = { SUX: 1, SEMI: 2, FULL: 3 };
const TIPO_PTS: Record<Tipo, number> = { T1: 1, T2: 2 };

const addPts = (a: AddTier | null | undefined): number => (a ? ADD_PTS[a] : 0);
const tipoPts = (t: Tipo | null | undefined): number => (t ? TIPO_PTS[t] : 0);

// Set / arma / escudo / cythera: só pontua a partir do +13.
function refinoSetPts(r: number | null | undefined): number {
  if (r == null) return 0;
  if (r >= 15) return 3;
  if (r === 14) return 2;
  if (r === 13) return 1;
  return 0;
}
// Capa: +11(+) = 2, +9/+10 = 1, senão 0.
function refinoCapaPts(r: number | null | undefined): number {
  if (r == null) return 0;
  if (r >= 11) return 2;
  if (r >= 9) return 1;
  return 0;
}
// Runa: +6..+9 = 2, +1..+5 = 1, não tem = 0.
function runaPts(r: number | null | undefined): number {
  if (r == null || r <= 0) return 0;
  return r >= 6 ? 2 : 1;
}
function petPts(lvl: number | null | undefined): number {
  if (lvl === 150) return 2;
  if (lvl === 120) return 1;
  return 0;
}

// ── Breakdown / total ────────────────────────────────────────────
export interface SlotScore {
  key: string;
  label: string;
  pontos: number;
}

export function slotBreakdown(eq: Equipment | null | undefined): SlotScore[] {
  const e = eq ?? {};
  const amu = e.amuletos ?? [];
  return [
    { key: 'pet', label: 'Cavalo/Pet', pontos: petPts(e.pet) },
    { key: 'cythera', label: 'Cythera', pontos: refinoSetPts(e.cythera?.refino) + addPts(e.cythera?.add) },
    { key: 'armadura', label: 'Armadura', pontos: refinoSetPts(e.armadura?.refino) },
    { key: 'calca', label: 'Calça', pontos: refinoSetPts(e.calca?.refino) },
    { key: 'luvas', label: 'Luvas', pontos: refinoSetPts(e.luvas?.refino) },
    { key: 'botas', label: 'Botas', pontos: refinoSetPts(e.botas?.refino) },
    { key: 'arma', label: 'Arma', pontos: refinoSetPts(e.arma?.refino) },
    { key: 'escudo', label: 'Escudo', pontos: refinoSetPts(e.escudo?.refino) },
    { key: 'capa', label: 'Capa', pontos: refinoCapaPts(e.capa?.refino) + addPts(e.capa?.add) },
    { key: 'runa', label: 'Runa', pontos: runaPts(e.runa?.refino) },
    { key: 'amuleto1', label: 'Amuleto 1', pontos: addPts(amu[0]) },
    { key: 'amuleto2', label: 'Amuleto 2', pontos: addPts(amu[1]) },
    { key: 'amuleto3', label: 'Amuleto 3', pontos: addPts(amu[2]) },
    { key: 'anel', label: 'Anel', pontos: tipoPts(e.anel) },
    { key: 'brinco', label: 'Brinco', pontos: tipoPts(e.brinco) },
    { key: 'cinto', label: 'Cinto', pontos: tipoPts(e.cinto) },
  ];
}

export function gearScore(eq: Equipment | null | undefined): number {
  return slotBreakdown(eq).reduce((sum, s) => sum + s.pontos, 0);
}

// GEAR_MAX derivado do set máximo (auto-valida em 48).
const MAX_EQUIP: Equipment = {
  pet: 150,
  cythera: { refino: 15, add: 'FULL' },
  armadura: { refino: 15 }, calca: { refino: 15 }, luvas: { refino: 15 }, botas: { refino: 15 },
  arma: { refino: 15 }, escudo: { refino: 15 },
  capa: { refino: 11, add: 'FULL' },
  runa: { refino: 9 },
  amuletos: ['FULL', 'FULL', 'FULL'],
  anel: 'T2', brinco: 'T2', cinto: 'T2',
};
export const GEAR_MAX = gearScore(MAX_EQUIP);

// ── Validação de payload (servidor) ──────────────────────────────
const ADDS: AddTier[] = ['SUX', 'SEMI', 'FULL'];
const TIPOS: Tipo[] = ['T1', 'T2'];

function vRefino(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 15) throw new Error('Refino inválido.');
  return v;
}
function vAdd(v: unknown): AddTier | null {
  if (v == null) return null;
  if (typeof v !== 'string' || !ADDS.includes(v as AddTier)) throw new Error('Add inválido.');
  return v as AddTier;
}
function vTipo(v: unknown): Tipo | null {
  if (v == null) return null;
  if (typeof v !== 'string' || !TIPOS.includes(v as Tipo)) throw new Error('Tipo inválido.');
  return v as Tipo;
}
function vPet(v: unknown): 120 | 150 | null {
  if (v == null) return null;
  if (v === 120 || v === 150) return v;
  throw new Error('Pet inválido.');
}

export function parseEquipment(input: unknown): Equipment {
  if (input == null || typeof input !== 'object') throw new Error('Equipamento inválido.');
  const e = input as Record<string, { refino?: unknown; add?: unknown } | unknown>;
  const dim = (o: unknown): { refino?: unknown; add?: unknown } =>
    o && typeof o === 'object' ? (o as { refino?: unknown; add?: unknown }) : {};
  const amuRaw = Array.isArray((e as { amuletos?: unknown }).amuletos)
    ? ((e as { amuletos?: unknown[] }).amuletos as unknown[])
    : [];
  if (amuRaw.length > 3) throw new Error('Máximo de 3 amuletos.');
  return {
    pet: vPet((e as { pet?: unknown }).pet),
    cythera: { refino: vRefino(dim(e.cythera).refino), add: vAdd(dim(e.cythera).add) },
    armadura: { refino: vRefino(dim(e.armadura).refino) },
    calca: { refino: vRefino(dim(e.calca).refino) },
    luvas: { refino: vRefino(dim(e.luvas).refino) },
    botas: { refino: vRefino(dim(e.botas).refino) },
    arma: { refino: vRefino(dim(e.arma).refino) },
    escudo: { refino: vRefino(dim(e.escudo).refino) },
    capa: { refino: vRefino(dim(e.capa).refino), add: vAdd(dim(e.capa).add) },
    runa: { refino: vRefino(dim(e.runa).refino) },
    amuletos: amuRaw.map(vAdd),
    anel: vTipo((e as { anel?: unknown }).anel),
    brinco: vTipo((e as { brinco?: unknown }).brinco),
    cinto: vTipo((e as { cinto?: unknown }).cinto),
  };
}
```

- [ ] **Step 5: Rodar os testes e confirmar verde**

Run: `npm test -- gear`
Expected: PASS (todos os testes do bloco gear). Depois `npm test` inteiro segue verde.

- [ ] **Step 6: `tsc` limpo**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add lib/types.ts lib/gear.ts tests/gear.test.ts
git commit -m "feat(gear): tipos de equipamento + motor de pontuacao (gear score 0-48) com testes"
```

---

### Task 2: Persistência do equipamento (schema + `characters.ts` + rota PUT)

**Files:**
- Modify: `lib/schema.sql` (coluna `equipment JSONB`)
- Modify: `lib/characters.ts` (`listCharacters` traz equipment+score; nova `updateEquipment`)
- Create: `app/api/characters/[id]/equipment/route.ts`

**Interfaces:**
- Consumes: `gearScore`, `parseEquipment` (Task 1); `Equipment` (Task 1)
- Produces: `updateEquipment(userId: string, id: string, input: unknown): Promise<{ score: number }>`; `GET /api/characters` passa a incluir `equipment` e `score`; rota `PUT /api/characters/[id]/equipment`.

- [ ] **Step 1: Migração no `lib/schema.sql`**

Adicione junto das outras migrações idempotentes (perto das `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`):

```sql
-- Equipamento do personagem (set inteiro num JSON). Gear score é derivado.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS equipment JSONB;
```

- [ ] **Step 2: Aplicar o schema**

Run: `npm run db:init`
Expected: roda sem erro (idempotente).

- [ ] **Step 3: Atualizar `lib/characters.ts`**

Ajuste os imports do topo:

```ts
import { query, queryOne, withTransaction, newId } from './db';
import { HttpError } from './auth';
import { isValidCombo } from './wyd';
import { gearScore, parseEquipment } from './gear';
import type { CharacterDTO, Equipment, SessionUser } from './types';
```

Substitua `listCharacters` por:

```ts
export async function listCharacters(userId: string): Promise<CharacterDTO[]> {
  const rows = await query<{
    id: string; nome: string; classe: CharacterDTO['classe'];
    especializacao: CharacterDTO['especializacao']; principal: boolean;
    equipment: Equipment | null;
  }>(
    `SELECT id, nome, classe, especializacao, principal, equipment
     FROM characters WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id, nome: r.nome, classe: r.classe, especializacao: r.especializacao,
    principal: r.principal, equipment: r.equipment, score: gearScore(r.equipment),
  }));
}
```

Adicione ao final do arquivo:

```ts
export async function updateEquipment(userId: string, id: string, input: unknown): Promise<{ score: number }> {
  let eq: Equipment;
  try {
    eq = parseEquipment(input);
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : 'Equipamento inválido.');
  }
  const rows = await query<{ id: string }>(
    `UPDATE characters SET equipment = $3 WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId, JSON.stringify(eq)],
  );
  if (!rows[0]) throw new HttpError(404, 'Personagem não encontrado.');
  return { score: gearScore(eq) };
}
```

- [ ] **Step 4: Criar a rota `app/api/characters/[id]/equipment/route.ts`**

```ts
import { requireUser, toResponse } from '@/lib/auth';
import { updateEquipment } from '@/lib/characters';

// Salva o set do personagem (só o dono edita).
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();
    return Response.json(await updateEquipment(user.id, id, body));
  } catch (e) {
    return toResponse(e);
  }
}
```

- [ ] **Step 5: Verificar tipos e build**

Run: `npx tsc --noEmit && npm test`
Expected: tsc sem erros; suíte de testes verde (nada quebrou).

- [ ] **Step 6: Commit**

```bash
git add lib/schema.sql lib/characters.ts "app/api/characters/[id]/equipment/route.ts"
git commit -m "feat(gear): persiste equipment (JSONB) + rota PUT e score na listagem de personagens"
```

---

### Task 3: Ranking de força do líder (backend)

**Files:**
- Modify: `lib/admin.ts` (nova `gearRanking` + tipo `GearRankEntry`)
- Create: `app/api/admin/gear/route.ts`

**Interfaces:**
- Consumes: `gearScore`, `slotBreakdown`, `SlotScore` (Task 1); `Equipment` (Task 1); `requireLeader` (existente em `lib/leader-auth.ts`)
- Produces: `gearRanking(): Promise<GearRankEntry[]>`; rota `GET /api/admin/gear`.

- [ ] **Step 1: Adicionar imports em `lib/admin.ts`**

No bloco de imports do topo, acrescente:

```ts
import { gearScore, slotBreakdown, type SlotScore } from './gear';
import type { Equipment } from './types';
```

- [ ] **Step 2: Adicionar `gearRanking` ao final de `lib/admin.ts`**

```ts
export interface GearRankEntry {
  userNome: string;
  personagem: string;
  classe: string;
  especializacao: string;
  score: number;
  breakdown: SlotScore[];
}

// Todos os personagens ordenados por gear score (maior primeiro). Para o líder
// montar a composição da guerra.
export async function gearRanking(): Promise<GearRankEntry[]> {
  const rows = await query<{
    userNome: string; personagem: string; classe: string;
    especializacao: string; equipment: Equipment | null;
  }>(
    `SELECT u.nome AS "userNome", ch.nome AS personagem, ch.classe,
            ch.especializacao, ch.equipment
     FROM characters ch JOIN users u ON u.id = ch.user_id`,
  );
  return rows
    .map((r) => ({
      userNome: r.userNome, personagem: r.personagem, classe: r.classe,
      especializacao: r.especializacao,
      score: gearScore(r.equipment), breakdown: slotBreakdown(r.equipment),
    }))
    .sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 3: Criar a rota `app/api/admin/gear/route.ts`**

```ts
import { toResponse } from '@/lib/auth';
import { requireLeader } from '@/lib/leader-auth';
import { gearRanking } from '@/lib/admin';

export async function GET(): Promise<Response> {
  try {
    await requireLeader();
    return Response.json(await gearRanking());
  } catch (e) {
    return toResponse(e);
  }
}
```

- [ ] **Step 4: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc sem erros; build conclui (rota `/api/admin/gear` aparece na lista).

- [ ] **Step 5: Commit**

```bash
git add lib/admin.ts app/api/admin/gear/route.ts
git commit -m "feat(gear): ranking de forca do lider (GET /api/admin/gear)"
```

---

### Task 4: Tela do SET — `EquipmentGrid` + botão SET + score do jogador

**Files:**
- Create: `components/EquipmentGrid.tsx`
- Modify: `app/globals.css` (estilos da grade)
- Modify: `components/WarScreen.tsx` (botão SET + score no sheet "Meus personagens")

**Interfaces:**
- Consumes: `gearScore`, `slotBreakdown`, `GEAR_MAX` (Task 1); `Equipment`, `AddTier`, `Tipo`, `CharacterDTO` (Task 1); `api` (existente); `PUT /api/characters/[id]/equipment` (Task 2).
- Produces: `<EquipmentGrid character onClose onSaved />`.

- [ ] **Step 1: Criar `components/EquipmentGrid.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { slotBreakdown, gearScore, GEAR_MAX } from '@/lib/gear';
import type { AddTier, CharacterDTO, Equipment, Tipo } from '@/lib/types';

type Kind = 'refino' | 'refinoAdd' | 'capa' | 'runa' | 'add' | 'tipo' | 'pet';

interface SlotDef {
  key: string;
  label: string;
  kind: Kind;
  area: string; // grid-area (layout WYD, refinado na Task 6)
}

// Ordem/posição inicial (aproxima o agrupamento do WYD; posições exatas na Task 6).
const SLOTS: SlotDef[] = [
  { key: 'pet', label: 'Pet', kind: 'pet', area: 'pet' },
  { key: 'cythera', label: 'Cythera', kind: 'refinoAdd', area: 'cythera' },
  { key: 'capa', label: 'Capa', kind: 'capa', area: 'capa' },
  { key: 'runa', label: 'Runa', kind: 'runa', area: 'runa' },
  { key: 'arma', label: 'Arma', kind: 'refino', area: 'arma' },
  { key: 'escudo', label: 'Escudo', kind: 'refino', area: 'escudo' },
  { key: 'armadura', label: 'Armadura', kind: 'refino', area: 'armadura' },
  { key: 'calca', label: 'Calça', kind: 'refino', area: 'calca' },
  { key: 'luvas', label: 'Luvas', kind: 'refino', area: 'luvas' },
  { key: 'botas', label: 'Botas', kind: 'refino', area: 'botas' },
  { key: 'amuleto1', label: 'Amuleto 1', kind: 'add', area: 'amu1' },
  { key: 'amuleto2', label: 'Amuleto 2', kind: 'add', area: 'amu2' },
  { key: 'amuleto3', label: 'Amuleto 3', kind: 'add', area: 'amu3' },
  { key: 'anel', label: 'Anel', kind: 'tipo', area: 'anel' },
  { key: 'brinco', label: 'Brinco', kind: 'tipo', area: 'brinco' },
  { key: 'cinto', label: 'Cinto', kind: 'tipo', area: 'cinto' },
];

// ── leitura/escrita imutável do valor de cada slot ────────────────
function amuIndex(key: string): number {
  return { amuleto1: 0, amuleto2: 1, amuleto3: 2 }[key] ?? -1;
}
function setAmu(eq: Equipment, i: number, v: AddTier | null): Equipment {
  const arr: (AddTier | null)[] = [eq.amuletos?.[0] ?? null, eq.amuletos?.[1] ?? null, eq.amuletos?.[2] ?? null];
  arr[i] = v;
  return { ...eq, amuletos: arr };
}
function badge(eq: Equipment, s: SlotDef): string {
  const p = (r?: number | null) => (r == null ? '' : `+${r}`);
  const a = (t?: AddTier | null) => (t ? ` ${t.toLowerCase()}` : '');
  switch (s.kind) {
    case 'pet': return eq.pet ? `lvl ${eq.pet}` : '—';
    case 'refinoAdd': return eq.cythera?.refino || eq.cythera?.add ? `${p(eq.cythera?.refino) || '—'}${a(eq.cythera?.add)}` : '—';
    case 'capa': return eq.capa?.refino || eq.capa?.add ? `${p(eq.capa?.refino) || '+0'}${a(eq.capa?.add)}` : '—';
    case 'runa': return eq.runa?.refino ? `+${eq.runa.refino}` : '—';
    case 'add': { const i = amuIndex(s.key); const v = eq.amuletos?.[i]; return v ? v.toLowerCase() : '—'; }
    case 'tipo': { const v = eq[s.key as 'anel' | 'brinco' | 'cinto']; return v ?? '—'; }
    default: { const v = eq[s.key as 'arma' | 'escudo' | 'armadura' | 'calca' | 'luvas' | 'botas']; return p(v?.refino) || '—'; }
  }
}

// botões de opção genéricos
function Opts<T extends string | number | null>({ value, opts, onPick }: {
  value: T; opts: [string, T][]; onPick: (v: T) => void;
}) {
  return (
    <div className="equip-opts">
      {opts.map(([lbl, v]) => (
        <button key={lbl} className={`pick-btn${value === v ? ' on' : ''}`} onClick={() => onPick(v)}>{lbl}</button>
      ))}
    </div>
  );
}

const REFINO_OPTS: [string, number | null][] = [['< +13', null], ['+13', 13], ['+14', 14], ['+15', 15]];
const CAPA_OPTS: [string, number | null][] = [['+0', null], ['+9', 9], ['+11', 11]];
const RUNA_OPTS: [string, number | null][] = [['não tem', null], ['+1–5', 5], ['+6–9', 9]];
const ADD_OPTS: [string, AddTier | null][] = [['não tem', null], ['sux', 'SUX'], ['semi', 'SEMI'], ['full', 'FULL']];
const TIPO_OPTS: [string, Tipo | null][] = [['não tem', null], ['T1', 'T1'], ['T2', 'T2']];
const PET_OPTS: [string, 120 | 150 | null][] = [['não tem', null], ['lvl 120', 120], ['lvl 150', 150]];

export default function EquipmentGrid({ character, onClose, onSaved }: {
  character: CharacterDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [eq, setEq] = useState<Equipment>(character.equipment ?? {});
  const [editing, setEditing] = useState<SlotDef | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const score = gearScore(eq);
  const bySlot = new Map(slotBreakdown(eq).map((s) => [s.key, s.pontos]));

  async function save() {
    setSaving(true); setError(null);
    try {
      await api(`/api/characters/${character.id}/equipment`, { method: 'PUT', body: JSON.stringify(eq) });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet equip-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="equip-head">
          <h2 className="sheet-title" style={{ margin: 0 }}>Equipamento · {character.nome}</h2>
          <div className="equip-score">{score}<span>/{GEAR_MAX}</span></div>
        </div>

        <div className="equip-grid">
          {SLOTS.map((s) => (
            <button key={s.key} className="equip-slot" style={{ gridArea: s.area }} onClick={() => setEditing(s)}>
              <span className="equip-slot-label">{s.label}</span>
              <span className="equip-slot-val">{badge(eq, s)}</span>
              <span className="equip-slot-pts">{bySlot.get(s.key) ?? 0} pt</span>
            </button>
          ))}
        </div>

        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          <button onClick={onClose} className="btn-cancel">Fechar</button>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>

      {editing && (
        <div className="sheet-overlay" onClick={() => setEditing(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2 className="sheet-title">{editing.label}</h2>
            {renderPicker(editing, eq, setEq)}
            <button className="btn-ghost full" style={{ marginTop: 12 }} onClick={() => setEditing(null)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

function renderPicker(s: SlotDef, eq: Equipment, setEq: (e: Equipment) => void) {
  switch (s.kind) {
    case 'pet':
      return <Opts value={eq.pet ?? null} opts={PET_OPTS} onPick={(v) => setEq({ ...eq, pet: v })} />;
    case 'runa':
      return <Opts value={eq.runa?.refino ?? null} opts={RUNA_OPTS} onPick={(v) => setEq({ ...eq, runa: { refino: v } })} />;
    case 'tipo': {
      const k = s.key as 'anel' | 'brinco' | 'cinto';
      return <Opts value={eq[k] ?? null} opts={TIPO_OPTS} onPick={(v) => setEq({ ...eq, [k]: v })} />;
    }
    case 'add': {
      const i = amuIndex(s.key);
      return <Opts value={eq.amuletos?.[i] ?? null} opts={ADD_OPTS} onPick={(v) => setEq(setAmu(eq, i, v))} />;
    }
    case 'refinoAdd':
      return (
        <>
          <label className="field-label">Refino</label>
          <Opts value={eq.cythera?.refino ?? null} opts={REFINO_OPTS} onPick={(v) => setEq({ ...eq, cythera: { ...eq.cythera, refino: v } })} />
          <label className="field-label" style={{ marginTop: 12 }}>Add</label>
          <Opts value={eq.cythera?.add ?? null} opts={ADD_OPTS} onPick={(v) => setEq({ ...eq, cythera: { ...eq.cythera, add: v } })} />
        </>
      );
    case 'capa':
      return (
        <>
          <label className="field-label">Refino</label>
          <Opts value={eq.capa?.refino ?? null} opts={CAPA_OPTS} onPick={(v) => setEq({ ...eq, capa: { ...eq.capa, refino: v } })} />
          <label className="field-label" style={{ marginTop: 12 }}>Add</label>
          <Opts value={eq.capa?.add ?? null} opts={ADD_OPTS} onPick={(v) => setEq({ ...eq, capa: { ...eq.capa, add: v } })} />
        </>
      );
    default: {
      const k = s.key as 'arma' | 'escudo' | 'armadura' | 'calca' | 'luvas' | 'botas';
      return <Opts value={eq[k]?.refino ?? null} opts={REFINO_OPTS} onPick={(v) => setEq({ ...eq, [k]: { refino: v } })} />;
    }
  }
}
```

- [ ] **Step 2: Estilos no `app/globals.css`**

Acrescente ao final do arquivo:

```css
/* ── Tela do SET (grade estilo WYD) ───────────────────────────── */
.equip-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.equip-score { font-family: var(--font-cinzel), serif; font-size: 26px; font-weight: 800; color: var(--gold); }
.equip-score span { font-size: 15px; color: var(--muted); }
.equip-grid {
  display: grid; gap: 8px;
  grid-template-columns: repeat(4, 1fr);
  grid-template-areas:
    "pet    cythera capa   runa"
    "amu1   armadura arma  escudo"
    "amu2   calca   luvas  botas"
    "amu3   anel    brinco cinto";
}
.equip-slot {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  aspect-ratio: 1 / 1; padding: 4px; cursor: pointer;
  background: linear-gradient(180deg, rgba(26,20,16,.95), rgba(14,10,8,.97));
  border: 1px solid rgba(212,178,90,.28); border-radius: 8px;
  color: var(--text); transition: transform .12s ease, border-color .15s ease;
}
.equip-slot:hover { border-color: var(--accent); transform: translateY(-1px); }
.equip-slot-label { font-size: 9px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
.equip-slot-val { font-weight: 800; font-size: 13px; color: #f0e6d2; text-align: center; }
.equip-slot-pts { font-size: 9px; color: var(--accent); }
.equip-opts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.equip-sheet { max-width: 480px; }
```

- [ ] **Step 3: Ligar o botão SET + score no `components/WarScreen.tsx`**

Import no topo (junto dos outros componentes):

```tsx
import EquipmentGrid from './EquipmentGrid';
import type { CharacterDTO } from '@/lib/types';
```

Adicione o estado (junto dos outros `useState`):

```tsx
const [equipChar, setEquipChar] = useState<CharacterDTO | null>(null);
```

No sheet "Meus personagens", troque o bloco que mapeia `characters` (o `.map((c) => ...)` com o `CharacterForm initial={c}`) por:

```tsx
{characters.map((c) => (
  <div key={c.id} className="manage-block">
    <CharacterForm initial={c} onSaved={() => { setManaging(false); void reload(); }} />
    <div className="equip-row">
      <span className="equip-row-score">⚔️ Gear {c.score ?? 0}/48</span>
      <button className="btn-ghost" onClick={() => setEquipChar(c)}>SET</button>
    </div>
  </div>
))}
```

Adicione o overlay do EquipmentGrid logo antes do fechamento do bloco `{managing && (...)}` (dentro dele, após o botão "Fechar"):

```tsx
{equipChar && (
  <EquipmentGrid
    character={equipChar}
    onClose={() => setEquipChar(null)}
    onSaved={() => { setEquipChar(null); void reload(); }}
  />
)}
```

E o CSS da linha (no `app/globals.css`):

```css
.equip-row { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
.equip-row-score { font-size: 13px; color: var(--gold); font-weight: 700; }
```

- [ ] **Step 4: Build + smoke local**

Run: `npm run build`
Expected: build conclui sem erro de tipo.

Smoke manual (`npm run dev`): abrir → Personagens → num personagem, clicar **SET** → grade abre; tocar um slot → picker abre; escolher valores → score no topo atualiza; **Salvar** → sheet fecha; reabrir SET mostra os valores salvos; a linha mostra `Gear X/48`.

- [ ] **Step 5: Commit**

```bash
git add components/EquipmentGrid.tsx components/WarScreen.tsx app/globals.css
git commit -m "feat(gear): tela do SET (grade estilo WYD) + botao SET e gear score do jogador"
```

---

### Task 5: Aba "Força" no painel do líder (`AdminPanel`)

**Files:**
- Modify: `components/AdminPanel.tsx` (tab `forca` + componente `ForcaTab`)
- Modify: `app/globals.css` (estilos da tabela de ranking)

**Interfaces:**
- Consumes: `GET /api/admin/gear` → `GearRankEntry[]` (Task 3); `api`, `ApiError` (existentes).
- Produces: aba "Força" renderizando o ranking + detalhe por slot.

- [ ] **Step 1: Definir o tipo local e a tab em `AdminPanel.tsx`**

Troque a linha `type Tab = 'guerra' | 'premios' | 'jogadores';` por:

```tsx
type Tab = 'guerra' | 'premios' | 'jogadores' | 'forca';

interface GearRankEntry {
  userNome: string;
  personagem: string;
  classe: string;
  especializacao: string;
  score: number;
  breakdown: { key: string; label: string; pontos: number }[];
}
```

- [ ] **Step 2: Adicionar o botão da aba + render**

No `.tab-row`, após o botão "Jogadores", acrescente:

```tsx
<button className={`tab-btn${tab === 'forca' ? ' active' : ''}`} onClick={() => setTab('forca')}>Força</button>
```

E junto dos outros `{tab === ... && <... />}`:

```tsx
{tab === 'forca' && <ForcaTab />}
```

- [ ] **Step 3: Adicionar o componente `ForcaTab` (ao final do arquivo, fora do default export)**

```tsx
function ForcaTab() {
  const [rows, setRows] = useState<GearRankEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    api<GearRankEntry[]>('/api/admin/gear')
      .then(setRows)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Erro ao carregar.'));
  }, []);

  if (err) return <p className="error-text">{err}</p>;
  if (!rows) return <p className="muted">Carregando…</p>;
  if (rows.length === 0) return <p className="muted">Nenhum personagem com equipamento ainda.</p>;

  return (
    <div className="admin-card">
      <h2>Ranking de força</h2>
      <div className="gear-rank">
        {rows.map((r, i) => (
          <div key={`${r.userNome}-${r.personagem}-${i}`}>
            <button className="gear-rank-row" onClick={() => setOpen(open === i ? null : i)}>
              <span className="gear-pos">{i + 1}</span>
              <span className="gear-who">
                <span className="gear-pj">{r.personagem}</span>
                <span className="gear-sub">{r.userNome} · {r.classe} {r.especializacao}</span>
              </span>
              <span className="gear-score">{r.score}<em>/48</em></span>
            </button>
            {open === i && (
              <div className="gear-detail">
                {r.breakdown.map((b) => (
                  <span key={b.key} className="gear-chip">{b.label}: <strong>{b.pontos}</strong></span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Estilos no `app/globals.css`**

```css
/* ── Ranking de força (painel) ────────────────────────────────── */
.gear-rank { display: flex; flex-direction: column; gap: 6px; }
.gear-rank-row { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
  background: rgba(255,255,255,.03); border: 1px solid rgba(212,178,90,.16); border-radius: 8px;
  padding: 10px 12px; cursor: pointer; color: var(--text); }
.gear-rank-row:hover { border-color: var(--accent); }
.gear-pos { font-family: var(--font-cinzel), serif; font-size: 16px; color: var(--gold); min-width: 20px; }
.gear-who { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.gear-pj { font-weight: 700; color: #f0e6d2; }
.gear-sub { font-size: 11px; color: var(--muted); }
.gear-score { font-family: var(--font-cinzel), serif; font-weight: 800; font-size: 18px; color: var(--accent); }
.gear-score em { font-size: 12px; color: var(--muted); font-style: normal; }
.gear-detail { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px 4px; }
.gear-chip { font-size: 11px; color: var(--muted); background: rgba(0,0,0,.25); border-radius: 6px; padding: 3px 7px; }
```

- [ ] **Step 5: Build + smoke**

Run: `npm run build`
Expected: build ok.

Smoke: `/admin` → desbloquear líder → aba **Força** → lista ordenada por score; clicar numa linha abre o detalhe por slot.

- [ ] **Step 6: Commit**

```bash
git add components/AdminPanel.tsx app/globals.css
git commit -m "feat(gear): aba Forca no painel do lider com ranking e detalhe por slot"
```

---

### Task 6: Fidelidade visual — grade batendo o print do WYD

Polimento visual. Requer a imagem de referência no repo.

**Files:**
- Add: `docs/superpowers/specs/assets/equip-ref.png` (print do WYD — fornecido pelo usuário)
- Modify: `components/EquipmentGrid.tsx` (posições dos slots via `area`)
- Modify: `app/globals.css` (`grid-template-areas`, molduras, densidade)

- [ ] **Step 1: Salvar a imagem de referência**

Colocar o print da janela de Equipamento em `docs/superpowers/specs/assets/equip-ref.png`. (Se o usuário não fornecer o arquivo, seguir pela aproximação do agrupamento já feita na Task 4 e registrar isso no commit.)

- [ ] **Step 2: Ajustar `grid-template-areas` para o layout do print**

Comparar a grade com o print e reposicionar. Exemplo de arranjo mais fiel (montarias no topo, set ao centro, mão/capa à direita, acessórios embaixo) — ajustar os nomes de `area` em `SLOTS` (`EquipmentGrid.tsx`) para casar com estas áreas:

```css
.equip-grid {
  grid-template-areas:
    "pet     cythera  capa    runa"
    "amu1    armadura arma    escudo"
    "amu2    calca    luvas   botas"
    "amu3    anel     brinco  cinto";
}
```

Refinar molduras/ícones pra reforçar o clima WYD (bordas douradas, leve textura no fundo do slot, destaque nos slots com +15/full). Sem libs novas; só CSS.

- [ ] **Step 3: Conferir no navegador (mobile)**

Abrir o preview no viewport mobile (375px) e comparar lado a lado com `equip-ref.png`. Ajustar `gap`, `aspect-ratio` e fontes até ficar próximo e sem rolagem horizontal.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build ok.

- [ ] **Step 5: Commit**

```bash
git add components/EquipmentGrid.tsx app/globals.css docs/superpowers/specs/assets/equip-ref.png
git commit -m "feat(gear): grade do SET fiel ao layout de equipamento do WYD"
```

---

## Self-Review

**1. Spec coverage:**
- §2 regras de pontuação → Task 1 (`gear.ts` + testes de todas as faixas/fronteiras). ✔
- §3 modelo de dados (JSONB, sem coluna de score) → Task 1 (tipos) + Task 2 (schema). ✔
- §4 `lib/gear.ts` (gearScore, slotBreakdown, parseEquipment, GEAR_MAX) → Task 1. ✔
- §5 tela do SET (grade WYD, bottom-sheets por tipo, score ao vivo, sem trava de horário) → Task 4 (+ Task 6 fidelidade). ✔
- §6 ranking do líder (aba Força, por personagem, detalhe por slot) + score do jogador → Task 5 + Task 4 (linha `Gear X/48`). ✔
- §7 API (`GET /api/characters` com equipment+score, `PUT /api/characters/[id]/equipment`, `GET /api/admin/gear`) → Task 2 + Task 3. ✔
- §8 validação/segurança (parseEquipment, só dono edita, requireLeader) → Task 1 + Task 2 + Task 3. ✔
- §9 fidelidade visual → Task 6. ✔
- §10 testes vitest → Task 1. ✔

**2. Placeholder scan:** Sem "TBD/TODO"; todo passo de código traz o código completo. Task 6 é polimento visual (guiado por imagem), com CSS concreto de exemplo e critério de aceite. OK.

**3. Type consistency:** `Equipment`, `AddTier`, `Tipo`, `SlotScore`, `GearRankEntry` usados igual entre tasks. `gearScore`/`slotBreakdown`/`parseEquipment`/`GEAR_MAX` com as mesmas assinaturas em produtor (Task 1) e consumidores (2/3/4/5). `updateEquipment` retorna `{ score }`. `CharacterDTO.equipment?`/`score?` opcionais (não quebram create/update). OK.
