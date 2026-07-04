# Guerra — Plano de Implementação (Sistema de Presença Tática WYD)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web mobile-first onde jogadores da guild WYD confirmam presença em guerras (máx. 2 toques) e o líder vê composição tática agregada + alertas.

**Architecture:** App único Next.js 16 (App Router) com rotas API no mesmo projeto; Postgres (Neon); login exclusivamente via Google OAuth com sessão JWT em cookie httpOnly; eventos gerados lazy (sem cron); listas em tempo real por polling 8s; lógica de domínio pura em `lib/` testada com vitest.

**Tech Stack:** Next.js 16 (App Router, TS), React 19, Tailwind CSS v4, `pg`, `jose`, vitest. Deploy: Vercel + Neon.

**Spec:** `docs/superpowers/specs/2026-07-03-guerra-presenca-design.md`

## Global Constraints

- Projeto NOVO e independente em `C:\PROJETOS\guerra` — NÃO tocar no imperium-app.
- Autenticação SOMENTE Google OAuth (nenhuma senha no sistema).
- Sessão: 30 dias, cookie httpOnly `guerra_session`, `pv` = fingerprint de `google_sub`.
- Classes/espec válidas (única fonte: `lib/wyd.ts` + CHECK no banco): TK→FISICO,MAGO · BM→FISICO,MAGO · HT→FISICO · FM→CANCEL,BLOOD,MAGO.
- Máx. **2 personagens** por usuário (verificação em transação → 409).
- Eventos lazy sem CRON: Seg–Sex→TORRE, Dom→NOATUM, Sáb→nada; fuso **America/Sao_Paulo = UTC-3 fixo** (Brasil sem horário de verão desde 2019); horário default **21:00** via `settings` (`war_time_torre`, `war_time_noatum`).
- Pontos DERIVADOS por query: `5 × confirmações VOU + 5 × participou=true` (sem coluna).
- Confirmação trava quando `now >= event.data` (409). Check de participação só após esse horário.
- Summary/participation: só `role='ADMIN'` (`requireAdmin`).
- Backend entrega dados agregados; frontend não calcula composição.
- Textos da UI em português (Brasil). IDs `TEXT` (crypto.randomUUID).
- Testes vitest apenas para lógica de domínio pura (sem DB/rede nos testes).
- Env vars: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/types.ts` | Tipos compartilhados (DTOs, enums) |
| `lib/wyd.ts` | Classes/especializações válidas + labels (domínio puro) |
| `lib/summary.ts` | Agregação de composição + alertas (puro) |
| `lib/war-schedule.ts` | Cálculo da próxima guerra com fuso (puro) |
| `lib/session-token.ts` | Assinatura/fingerprint do JWT (puro, sem Next) |
| `lib/db.ts` | Pool pg, query helpers, transação, newId |
| `lib/schema.sql` | Schema idempotente |
| `lib/auth.ts` | Sessão via cookie (usa session-token + db), HttpError, toResponse |
| `lib/google-auth.ts` | Fluxo OAuth Google (URL, troca de code, validação id_token) |
| `lib/users.ts` | Upsert de usuário Google |
| `lib/settings.ts` | Leitura de horários das guerras |
| `lib/events.ts` | ensureNextEvent (lazy) / getEvent |
| `lib/characters.ts` | CRUD de personagens (máx 2, combos válidos) |
| `lib/war.ts` | Confirmações, listas, summary (via lib/summary), participação, pontos |
| `lib/api-client.ts` | fetch wrapper do frontend com err.status |
| `app/api/auth/google/route.ts` | Redirect ao consent (state anti-CSRF) |
| `app/api/auth/google/callback/route.ts` | Callback OAuth → sessão |
| `app/api/auth/me/route.ts` / `logout/route.ts` | Sessão atual / sair |
| `app/api/characters/route.ts` / `[id]/route.ts` | GET/POST / PATCH personagens |
| `app/api/war/current/route.ts` | Evento lazy + minha confirmação + chars + pontos |
| `app/api/war/[id]/confirm/route.ts` | POST confirmação |
| `app/api/war/[id]/list/route.ts` | Listas por status (polling) |
| `app/api/war/[id]/summary/route.ts` | Composição agregada + alertas (ADMIN) |
| `app/api/war/[id]/participation/route.ts` | Check participou (ADMIN) |
| `components/GuerraApp.tsx` | Raiz client: estados anon/wizard/ready |
| `components/LoginView.tsx` | Botão "Entrar com Google" |
| `components/CharacterWizard.tsx` | Cadastro/edição de personagem (botões) |
| `components/WarScreen.tsx` | Guerra em destaque, countdown, botões Vou/Não/Talvez, listas |
| `components/CharPicker.tsx` | Bottom-sheet de seleção de personagem |
| `components/LeaderPanel.tsx` | Composição, alertas, check de participação |
| `scripts/init-db.mjs` / `scripts/promote.mjs` | Aplicar schema / promover líder |

---

### Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: projeto Next 16 + Tailwind v4 + vitest compilando; `npm run build` e `npm test` verdes.

- [ ] **Step 1: Criar arquivos de configuração**

`package.json`:
```json
{
  "name": "guerra",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "db:init": "node scripts/init-db.mjs",
    "promote": "node scripts/promote.mjs"
  },
  "dependencies": {
    "jose": "^6.2.3",
    "next": "16.2.9",
    "pg": "^8.22.0",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/pg": "^8.20.0",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^3"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

`postcss.config.mjs`:
```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
```

`.gitignore`:
```
node_modules/
.next/
out/
.env*.local
.vercel
*.tsbuildinfo
next-env.d.ts
```

`.env.example`:
```
DATABASE_URL=postgres://user:senha@host/db?sslmode=require
JWT_SECRET=gerar-com-openssl-rand-hex-32
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxx
APP_URL=http://localhost:3000
```

- [ ] **Step 2: Criar app mínimo**

`app/globals.css`:
```css
@import "tailwindcss";

body {
  background: #0b0f1a;
  color: #e5e9f0;
}
```

`app/layout.tsx`:
```tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Guerra — Presença da Guild',
  description: 'Confirmação de presença nas guerras da guild (WYD)',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx` (placeholder até a Task 10):
```tsx
export default function Page() {
  return <main className="p-6 text-center">Guerra — em construção</main>;
}
```

`tests/smoke.test.ts`:
```ts
import { expect, test } from 'vitest';

test('vitest funciona', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 3: Instalar e verificar**

Run: `npm install`
Run: `npm test` — Expected: 1 passed
Run: `npm run build` — Expected: build verde ("Compiled successfully")

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 + Tailwind v4 + vitest"
```

---

### Task 2: Tipos + domínio WYD (classes/especializações)

**Files:**
- Create: `lib/types.ts`, `lib/wyd.ts`
- Test: `tests/wyd.test.ts`

**Interfaces:**
- Produces: `CLASSES: Classe[]`, `SPECS_BY_CLASS: Record<Classe, Especializacao[]>`, `SPEC_LABELS: Record<Especializacao, string>`, `TIPO_LABELS: Record<WarTipo, string>`, `isValidCombo(classe: string, especializacao: string): boolean`; tipos `Role`, `Classe`, `Especializacao`, `WarTipo`, `ConfirmStatus`, `SessionUser`, `CharacterDTO`, `ListEntry`, `WarListsDTO`.

- [ ] **Step 1: Escrever teste que falha**

`tests/wyd.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { CLASSES, SPECS_BY_CLASS, isValidCombo } from '../lib/wyd';

describe('domínio WYD', () => {
  test('tem as 4 classes', () => {
    expect(CLASSES).toEqual(['TK', 'BM', 'HT', 'FM']);
  });

  test('especializações por classe seguem a regra do jogo', () => {
    expect(SPECS_BY_CLASS.TK).toEqual(['FISICO', 'MAGO']);
    expect(SPECS_BY_CLASS.BM).toEqual(['FISICO', 'MAGO']);
    expect(SPECS_BY_CLASS.HT).toEqual(['FISICO']);
    expect(SPECS_BY_CLASS.FM).toEqual(['CANCEL', 'BLOOD', 'MAGO']);
  });

  test('aceita combinações válidas', () => {
    expect(isValidCombo('TK', 'FISICO')).toBe(true);
    expect(isValidCombo('FM', 'BLOOD')).toBe(true);
    expect(isValidCombo('HT', 'FISICO')).toBe(true);
  });

  test('rejeita combinações inválidas', () => {
    expect(isValidCombo('HT', 'MAGO')).toBe(false);
    expect(isValidCombo('FM', 'FISICO')).toBe(false);
    expect(isValidCombo('XX', 'FISICO')).toBe(false);
    expect(isValidCombo('', '')).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test` — Expected: FAIL (módulo `../lib/wyd` não existe)

- [ ] **Step 3: Implementar**

`lib/types.ts`:
```ts
export type Role = 'ADMIN' | 'MEMBRO';
export type Classe = 'TK' | 'BM' | 'HT' | 'FM';
export type Especializacao = 'FISICO' | 'MAGO' | 'CANCEL' | 'BLOOD';
export type WarTipo = 'TORRE' | 'NOATUM';
export type ConfirmStatus = 'VOU' | 'NAO_VOU' | 'TALVEZ';

export interface SessionUser {
  id: string;
  nome: string;
  role: Role;
}

export interface CharacterDTO {
  id: string;
  nome: string;
  classe: Classe;
  especializacao: Especializacao;
  principal: boolean;
}

export interface ListEntry {
  userId: string;
  nome: string;
  personagem: string | null;
  classe: Classe | null;
  especializacao: Especializacao | null;
  participou: boolean | null;
}

export interface WarListsDTO {
  vou: ListEntry[];
  talvez: ListEntry[];
  nao_vou: ListEntry[];
}
```

`lib/wyd.ts`:
```ts
import type { Classe, Especializacao, WarTipo } from './types';

export const CLASSES: Classe[] = ['TK', 'BM', 'HT', 'FM'];

export const SPECS_BY_CLASS: Record<Classe, Especializacao[]> = {
  TK: ['FISICO', 'MAGO'],
  BM: ['FISICO', 'MAGO'],
  HT: ['FISICO'],
  FM: ['CANCEL', 'BLOOD', 'MAGO'],
};

export const SPEC_LABELS: Record<Especializacao, string> = {
  FISICO: 'Físico',
  MAGO: 'Mago',
  CANCEL: 'Cancel',
  BLOOD: 'Blood',
};

export const TIPO_LABELS: Record<WarTipo, string> = {
  TORRE: 'Guerra de Torre',
  NOATUM: 'Guerra de Noatum',
};

export function isValidCombo(classe: string, especializacao: string): boolean {
  const specs = SPECS_BY_CLASS[classe as Classe];
  return !!specs && specs.includes(especializacao as Especializacao);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test` — Expected: PASS (todos)

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/wyd.ts tests/wyd.test.ts
git commit -m "feat: domínio WYD — classes, especializações e validação de combos"
```

---

### Task 3: Agregação de composição + alertas

**Files:**
- Create: `lib/summary.ts`
- Test: `tests/summary.test.ts`

**Interfaces:**
- Produces: `computeSummary(rows: ComboRow[]): Summary` onde `ComboRow = { classe: string; especializacao: string }` e `Summary = { counts: Record<string, number>; TOTAL_FISICO: number; TOTAL_MAGO: number; alerts: string[] }`.
- Regras: TOTAL_FISICO/TOTAL_MAGO somam só espec FISICO/MAGO (CANCEL/BLOOD ficam fora dos totais). Alertas (só se houver ≥1 confirmado): `FM_BLOOD < 2` → cura; `TK total < 3` → frente; físico ou mago > 65% de (físico+mago) → desbalanceio.

- [ ] **Step 1: Escrever teste que falha**

`tests/summary.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { computeSummary } from '../lib/summary';

function rows(spec: Record<string, number>) {
  const out: { classe: string; especializacao: string }[] = [];
  for (const [key, n] of Object.entries(spec)) {
    const [classe, especializacao] = key.split('_');
    for (let i = 0; i < n; i++) out.push({ classe, especializacao });
  }
  return out;
}

describe('computeSummary', () => {
  test('vazio: contagens zeradas e sem alertas', () => {
    const s = computeSummary([]);
    expect(s.counts).toEqual({});
    expect(s.TOTAL_FISICO).toBe(0);
    expect(s.TOTAL_MAGO).toBe(0);
    expect(s.alerts).toEqual([]);
  });

  test('cenário do escopo: contagens e totais corretos', () => {
    const s = computeSummary(rows({ BM_FISICO: 5, BM_MAGO: 2, TK_FISICO: 3, FM_BLOOD: 2, FM_CANCEL: 1, FM_MAGO: 6, HT_FISICO: 2 }));
    expect(s.counts.BM_FISICO).toBe(5);
    expect(s.counts.FM_BLOOD).toBe(2);
    expect(s.TOTAL_FISICO).toBe(10); // 5 BM + 3 TK + 2 HT
    expect(s.TOTAL_MAGO).toBe(8);    // 2 BM + 6 FM
    // FM_BLOOD=2 (ok), TK=3 (ok), 10/18=0.55 (ok) → sem alertas
    expect(s.alerts).toEqual([]);
  });

  test('alerta de cura quando FM_BLOOD < 2', () => {
    const s = computeSummary(rows({ TK_FISICO: 3, FM_BLOOD: 1, BM_MAGO: 2 }));
    expect(s.alerts).toContain('Falta de cura (poucos FM Blood)');
  });

  test('alerta de linha de frente quando TK < 3', () => {
    const s = computeSummary(rows({ TK_FISICO: 2, FM_BLOOD: 2, BM_MAGO: 2 }));
    expect(s.alerts).toContain('Linha de frente fraca (poucos TK)');
  });

  test('alerta de excesso de físicos quando > 65%', () => {
    const s = computeSummary(rows({ TK_FISICO: 5, BM_FISICO: 4, BM_MAGO: 1, FM_BLOOD: 2 }));
    expect(s.alerts).toContain('Composição desbalanceada (excesso de físicos)');
  });

  test('alerta de excesso de magos quando > 65%', () => {
    const s = computeSummary(rows({ TK_MAGO: 3, BM_MAGO: 4, TK_FISICO: 3, FM_BLOOD: 2 }));
    // magos 7 / (7+3) = 0.7 → alerta; TK total = 6 → sem alerta de frente
    expect(s.alerts).toContain('Composição desbalanceada (excesso de magos)');
    expect(s.alerts).not.toContain('Linha de frente fraca (poucos TK)');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test` — Expected: FAIL (módulo `../lib/summary` não existe)

- [ ] **Step 3: Implementar**

`lib/summary.ts`:
```ts
export interface ComboRow {
  classe: string;
  especializacao: string;
}

export interface Summary {
  counts: Record<string, number>;
  TOTAL_FISICO: number;
  TOTAL_MAGO: number;
  alerts: string[];
}

const MIN_FM_BLOOD = 2;
const MIN_TK = 3;
const IMBALANCE_RATIO = 0.65;

export function computeSummary(rows: ComboRow[]): Summary {
  const counts: Record<string, number> = {};
  let fisico = 0;
  let mago = 0;
  let tk = 0;

  for (const r of rows) {
    const key = `${r.classe}_${r.especializacao}`;
    counts[key] = (counts[key] ?? 0) + 1;
    if (r.especializacao === 'FISICO') fisico++;
    if (r.especializacao === 'MAGO') mago++;
    if (r.classe === 'TK') tk++;
  }

  const alerts: string[] = [];
  if (rows.length > 0) {
    if ((counts['FM_BLOOD'] ?? 0) < MIN_FM_BLOOD) alerts.push('Falta de cura (poucos FM Blood)');
    if (tk < MIN_TK) alerts.push('Linha de frente fraca (poucos TK)');
    const base = fisico + mago;
    if (base > 0) {
      if (fisico / base > IMBALANCE_RATIO) alerts.push('Composição desbalanceada (excesso de físicos)');
      if (mago / base > IMBALANCE_RATIO) alerts.push('Composição desbalanceada (excesso de magos)');
    }
  }

  return { counts, TOTAL_FISICO: fisico, TOTAL_MAGO: mago, alerts };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test` — Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/summary.ts tests/summary.test.ts
git commit -m "feat: agregação de composição e alertas táticos"
```

---

### Task 4: Cálculo da próxima guerra (fuso São Paulo)

**Files:**
- Create: `lib/war-schedule.ts`
- Test: `tests/war-schedule.test.ts`

**Interfaces:**
- Produces: `computeNextWar(nowUtc: Date, times: WarTimes): NextWar` com `WarTimes = { TORRE: string; NOATUM: string }` ("HH:MM") e `NextWar = { tipo: WarTipo; dia: string /* YYYY-MM-DD em SP */; dataUtc: Date }`; `warDateUtc(dia: string, time: string): Date`.

- [ ] **Step 1: Escrever teste que falha**

`tests/war-schedule.test.ts` (datas-âncora: 2026-07-01=quarta, 03=sexta, 04=sábado, 05=domingo, 06=segunda):
```ts
import { describe, expect, test } from 'vitest';
import { computeNextWar } from '../lib/war-schedule';

const TIMES = { TORRE: '21:00', NOATUM: '21:00' };

// helper: instante UTC de um horário de São Paulo (UTC-3)
function sp(dia: string, hora: string): Date {
  return new Date(`${dia}T${hora}:00-03:00`);
}

describe('computeNextWar', () => {
  test('quarta de manhã → Torre no mesmo dia às 21h SP', () => {
    const w = computeNextWar(sp('2026-07-01', '10:00'), TIMES);
    expect(w.tipo).toBe('TORRE');
    expect(w.dia).toBe('2026-07-01');
    expect(w.dataUtc.toISOString()).toBe(sp('2026-07-01', '21:00').toISOString());
  });

  test('quarta às 22h (guerra já passou) → Torre de quinta', () => {
    const w = computeNextWar(sp('2026-07-01', '22:00'), TIMES);
    expect(w.tipo).toBe('TORRE');
    expect(w.dia).toBe('2026-07-02');
  });

  test('sexta às 22h → pula sábado, Noatum de domingo', () => {
    const w = computeNextWar(sp('2026-07-03', '22:00'), TIMES);
    expect(w.tipo).toBe('NOATUM');
    expect(w.dia).toBe('2026-07-05');
  });

  test('sábado qualquer hora → Noatum de domingo', () => {
    const w = computeNextWar(sp('2026-07-04', '12:00'), TIMES);
    expect(w.tipo).toBe('NOATUM');
    expect(w.dia).toBe('2026-07-05');
  });

  test('domingo antes das 21h → Noatum do próprio domingo', () => {
    const w = computeNextWar(sp('2026-07-05', '20:00'), TIMES);
    expect(w.tipo).toBe('NOATUM');
    expect(w.dia).toBe('2026-07-05');
  });

  test('domingo às 22h → Torre de segunda', () => {
    const w = computeNextWar(sp('2026-07-05', '22:00'), TIMES);
    expect(w.tipo).toBe('TORRE');
    expect(w.dia).toBe('2026-07-06');
  });

  test('respeita horário customizado', () => {
    const w = computeNextWar(sp('2026-07-01', '19:30'), { TORRE: '19:00', NOATUM: '21:00' });
    // Torre de hoje era 19:00, já passou → quinta
    expect(w.dia).toBe('2026-07-02');
  });

  test('exatamente no horário da guerra conta como passada', () => {
    const w = computeNextWar(sp('2026-07-01', '21:00'), TIMES);
    expect(w.dia).toBe('2026-07-02');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test` — Expected: FAIL (módulo não existe)

- [ ] **Step 3: Implementar**

`lib/war-schedule.ts`:
```ts
import type { WarTipo } from './types';

// Brasil não tem horário de verão desde 2019 → São Paulo é UTC-3 fixo.
const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface WarTimes {
  TORRE: string; // "HH:MM"
  NOATUM: string;
}

export interface NextWar {
  tipo: WarTipo;
  dia: string; // YYYY-MM-DD no calendário de São Paulo
  dataUtc: Date;
}

function spCalendar(instantUtc: Date): { dia: string; dow: number } {
  const shifted = new Date(instantUtc.getTime() - SP_OFFSET_MS);
  return { dia: shifted.toISOString().slice(0, 10), dow: shifted.getUTCDay() };
}

function tipoDoDia(dow: number): WarTipo | null {
  if (dow >= 1 && dow <= 5) return 'TORRE'; // seg–sex
  if (dow === 0) return 'NOATUM'; // domingo
  return null; // sábado
}

export function warDateUtc(dia: string, time: string): Date {
  return new Date(`${dia}T${time}:00-03:00`);
}

export function computeNextWar(nowUtc: Date, times: WarTimes): NextWar {
  for (let i = 0; i < 8; i++) {
    const probe = new Date(nowUtc.getTime() + i * DAY_MS);
    const { dia, dow } = spCalendar(probe);
    const tipo = tipoDoDia(dow);
    if (!tipo) continue;
    const dataUtc = warDateUtc(dia, times[tipo]);
    if (dataUtc.getTime() > nowUtc.getTime()) return { tipo, dia, dataUtc };
  }
  throw new Error('Não foi possível calcular a próxima guerra.');
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test` — Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/war-schedule.ts tests/war-schedule.test.ts
git commit -m "feat: cálculo da próxima guerra (Seg-Sex Torre, Dom Noatum, fuso SP)"
```

---

### Task 5: Banco de dados — schema, pool e scripts

**Files:**
- Create: `lib/schema.sql`, `lib/db.ts`, `scripts/init-db.mjs`, `scripts/promote.mjs`, `scripts/load-env.mjs`

**Interfaces:**
- Produces: `query<T>(sql, params?): Promise<T[]>`, `queryOne<T>(sql, params?): Promise<T | null>`, `withTransaction<T>(fn): Promise<T>` (fn recebe `q(sql, params?)`), `newId(): string`.
- Sem testes unitários (wrapper fino de pg); validado no smoke test da Task 15.

- [ ] **Step 1: Escrever o schema**

`lib/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email      TEXT NOT NULL UNIQUE,
  nome       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'MEMBRO' CHECK (role IN ('ADMIN','MEMBRO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS characters (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome           TEXT NOT NULL,
  classe         TEXT NOT NULL,
  especializacao TEXT NOT NULL,
  principal      BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (classe = 'TK' AND especializacao IN ('FISICO','MAGO')) OR
    (classe = 'BM' AND especializacao IN ('FISICO','MAGO')) OR
    (classe = 'HT' AND especializacao = 'FISICO') OR
    (classe = 'FM' AND especializacao IN ('CANCEL','BLOOD','MAGO'))
  )
);

CREATE TABLE IF NOT EXISTS events (
  id   TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('TORRE','NOATUM')),
  data TIMESTAMPTZ NOT NULL,
  dia  DATE NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS confirmations (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
  status       TEXT NOT NULL CHECK (status IN ('VOU','NAO_VOU','TALVEZ')),
  participou   BOOLEAN,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_confirmations_event ON confirmations(event_id);
CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
```

- [ ] **Step 2: Implementar o pool**

`lib/db.ts`:
```ts
import { Pool, type QueryResultRow } from 'pg';

let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL não definida.');
    pool = new Pool({ connectionString: url, max: 3 });
  }
  return pool;
}

export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query<T>(sql, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

type TxQuery = <T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]) => Promise<T[]>;

export async function withTransaction<T>(fn: (q: TxQuery) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const q: TxQuery = async (sql, params = []) => (await client.query(sql, params)).rows;
    const result = await fn(q);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export function newId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 3: Scripts (carregador de env + init + promote)**

`scripts/load-env.mjs`:
```js
// Carrega .env.local para process.env (para scripts fora do Next).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  const env = readFileSync(path.join(root, '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {
  // sem .env.local: usa o ambiente atual
}
```

`scripts/init-db.mjs`:
```js
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
```

`scripts/promote.mjs`:
```js
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
```

- [ ] **Step 4: Verificar compilação**

Run: `npx tsc --noEmit` — Expected: sem erros
Run: `npm test` — Expected: PASS (testes existentes seguem verdes)

- [ ] **Step 5: Commit**

```bash
git add lib/schema.sql lib/db.ts scripts/
git commit -m "feat: schema Postgres, pool pg e scripts db:init/promote"
```

---

### Task 6: Token de sessão (puro) + sessão via cookie

**Files:**
- Create: `lib/session-token.ts`, `lib/auth.ts`
- Test: `tests/session-token.test.ts`

**Interfaces:**
- Produces (puro): `subFingerprint(googleSub: string): string`, `signSessionToken(user: SessionUser, googleSub: string, secret: Uint8Array, maxAgeSeconds: number): Promise<string>`.
- Produces (Next): `createSession(user: SessionUser, googleSub: string): Promise<void>`, `destroySession()`, `getSession(): Promise<SessionUser | null>`, `requireUser()`, `requireAdmin()`, `class HttpError(status, message)`, `toResponse(e: unknown): Response`.
- Cookie: `guerra_session`, httpOnly, 30 dias (`SESSION_MAX_AGE = 60*60*24*30`).

- [ ] **Step 1: Escrever teste que falha**

`tests/session-token.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { jwtVerify } from 'jose';
import { signSessionToken, subFingerprint } from '../lib/session-token';

const SECRET = new TextEncoder().encode('segredo-de-teste-32-caracteres!!');

describe('token de sessão', () => {
  test('fingerprint é estável e muda com o sub', () => {
    expect(subFingerprint('sub-a')).toBe(subFingerprint('sub-a'));
    expect(subFingerprint('sub-a')).not.toBe(subFingerprint('sub-b'));
    expect(subFingerprint('sub-a')).toHaveLength(16);
  });

  test('assina e verifica com payload correto', async () => {
    const token = await signSessionToken(
      { id: 'u1', nome: 'Ruan', role: 'MEMBRO' },
      'google-sub-123',
      SECRET,
      3600,
    );
    const { payload } = await jwtVerify(token, SECRET);
    expect(payload.sub).toBe('u1');
    expect(payload.nome).toBe('Ruan');
    expect(payload.role).toBe('MEMBRO');
    expect(payload.pv).toBe(subFingerprint('google-sub-123'));
    expect(payload.exp! - payload.iat!).toBe(3600);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test` — Expected: FAIL (módulo não existe)

- [ ] **Step 3: Implementar**

`lib/session-token.ts`:
```ts
import { SignJWT } from 'jose';
import { createHash } from 'crypto';
import type { SessionUser } from './types';

// Fingerprint do google_sub. Vai no token como `pv`; se o google_sub do
// usuário for trocado/limpo no banco, as sessões antigas caem.
export function subFingerprint(googleSub: string): string {
  return createHash('sha256').update(googleSub).digest('hex').slice(0, 16);
}

export async function signSessionToken(
  user: SessionUser,
  googleSub: string,
  secret: Uint8Array,
  maxAgeSeconds: number,
): Promise<string> {
  return new SignJWT({ nome: user.nome, role: user.role, pv: subFingerprint(googleSub) })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secret);
}
```

`lib/auth.ts`:
```ts
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { queryOne } from './db';
import { signSessionToken, subFingerprint } from './session-token';
import type { Role, SessionUser } from './types';

const COOKIE = 'guerra_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias — sem fricção após 1º acesso

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET não definida.');
  return new TextEncoder().encode(s);
}

export async function createSession(user: SessionUser, googleSub: string): Promise<void> {
  const token = await signSessionToken(user, googleSub, secret(), SESSION_MAX_AGE);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const id = String(payload.sub);
    const row = await queryOne<{ google_sub: string; nome: string; role: Role }>(
      'SELECT google_sub, nome, role FROM users WHERE id = $1',
      [id],
    );
    if (!row) return null;
    if (payload.pv !== subFingerprint(row.google_sub)) return null; // sub trocado → sessão cai
    return { id, nome: row.nome, role: row.role };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new HttpError(401, 'Não autenticado.');
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new HttpError(403, 'Acesso restrito ao líder.');
  return user;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function toResponse(e: unknown): Response {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: 'Erro interno.' }, { status: 500 });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test` — Expected: PASS
Run: `npx tsc --noEmit` — Expected: sem erros

- [ ] **Step 5: Commit**

```bash
git add lib/session-token.ts lib/auth.ts tests/session-token.test.ts
git commit -m "feat: sessão JWT 30d em cookie httpOnly com fingerprint do google_sub"
```

---

### Task 7: Google OAuth + upsert de usuário + rotas de auth

**Files:**
- Create: `lib/google-auth.ts`, `lib/users.ts`, `app/api/auth/google/route.ts`, `app/api/auth/google/callback/route.ts`, `app/api/auth/me/route.ts`, `app/api/auth/logout/route.ts`
- Test: `tests/google-auth.test.ts`

**Interfaces:**
- Produces: `buildAuthUrl(state, clientId, redirect): string` (puro), `googleAuthUrl(state): string`, `redirectUri(): string`, `exchangeAndVerify(code): Promise<GoogleProfile>` com `GoogleProfile = { sub: string; email: string; nome: string }`; `upsertGoogleUser(p: GoogleProfile): Promise<{ id, nome, role, google_sub }>`.
- Rotas: `GET /api/auth/google` (302 com state em cookie `oauth_state` 10 min), `GET /api/auth/google/callback` (302 → `/` ou `/?erro=login`), `GET /api/auth/me` → `{ nome, role }`, `POST /api/auth/logout`.

- [ ] **Step 1: Escrever teste que falha (parte pura)**

`tests/google-auth.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { buildAuthUrl } from '../lib/google-auth';

describe('buildAuthUrl', () => {
  test('monta URL do consent com todos os parâmetros', () => {
    const url = new URL(buildAuthUrl('state-xyz', 'client-123', 'http://localhost:3000/api/auth/google/callback'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('client-123');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/google/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('state')).toBe('state-xyz');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test` — Expected: FAIL

- [ ] **Step 3: Implementar lib**

`lib/google-auth.ts`:
```ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} não definida.`);
  return v;
}

export function redirectUri(): string {
  return `${env('APP_URL')}/api/auth/google/callback`;
}

export function buildAuthUrl(state: string, clientId: string, redirect: string): string {
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH}?${p.toString()}`;
}

export function googleAuthUrl(state: string): string {
  return buildAuthUrl(state, env('GOOGLE_CLIENT_ID'), redirectUri());
}

export interface GoogleProfile {
  sub: string;
  email: string;
  nome: string;
}

export async function exchangeAndVerify(code: string): Promise<GoogleProfile> {
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Endpoint de token do Google: HTTP ${res.status}`);
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error('Resposta do Google sem id_token.');

  const { payload } = await jwtVerify(data.id_token, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: env('GOOGLE_CLIENT_ID'),
  });
  const sub = String(payload.sub);
  const email = String(payload.email ?? '');
  if (!email) throw new Error('id_token sem e-mail.');
  const nome = String(payload.name ?? email.split('@')[0]);
  return { sub, email, nome };
}
```

`lib/users.ts`:
```ts
import { queryOne, newId } from './db';
import type { Role } from './types';
import type { GoogleProfile } from './google-auth';

export interface UserRow {
  id: string;
  nome: string;
  role: Role;
  google_sub: string;
}

const RETURNING = 'RETURNING id, nome, role, google_sub';

export async function upsertGoogleUser(p: GoogleProfile): Promise<UserRow> {
  try {
    const row = await queryOne<UserRow>(
      `INSERT INTO users (id, google_sub, email, nome)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_sub) DO UPDATE SET email = EXCLUDED.email, nome = EXCLUDED.nome
       ${RETURNING}`,
      [newId(), p.sub, p.email, p.nome],
    );
    return row!;
  } catch (e) {
    // Conflito no e-mail (conta Google recriada com novo sub): reatribui o sub.
    if ((e as { code?: string }).code === '23505') {
      const row = await queryOne<UserRow>(
        `UPDATE users SET google_sub = $1, nome = $2 WHERE email = $3 ${RETURNING}`,
        [p.sub, p.nome, p.email],
      );
      if (row) return row;
    }
    throw e;
  }
}
```

- [ ] **Step 4: Implementar rotas**

`app/api/auth/google/route.ts`:
```ts
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import { googleAuthUrl } from '@/lib/google-auth';

export async function GET(): Promise<Response> {
  const state = randomBytes(16).toString('hex');
  const jar = await cookies();
  jar.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return Response.redirect(googleAuthUrl(state), 302);
}
```

`app/api/auth/google/callback/route.ts`:
```ts
import { cookies } from 'next/headers';
import { exchangeAndVerify } from '@/lib/google-auth';
import { upsertGoogleUser } from '@/lib/users';
import { createSession } from '@/lib/auth';

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const jar = await cookies();
  const saved = jar.get('oauth_state')?.value;
  jar.delete('oauth_state');
  const home = process.env.APP_URL ?? '';

  if (!code || !state || !saved || state !== saved) {
    return Response.redirect(`${home}/?erro=login`, 302);
  }
  try {
    const profile = await exchangeAndVerify(code);
    const user = await upsertGoogleUser(profile);
    await createSession({ id: user.id, nome: user.nome, role: user.role }, user.google_sub);
    return Response.redirect(`${home}/`, 302);
  } catch (e) {
    console.error('Callback do Google falhou:', e);
    return Response.redirect(`${home}/?erro=login`, 302);
  }
}
```

`app/api/auth/me/route.ts`:
```ts
import { requireUser, toResponse } from '@/lib/auth';

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    return Response.json({ nome: user.nome, role: user.role });
  } catch (e) {
    return toResponse(e);
  }
}
```

`app/api/auth/logout/route.ts`:
```ts
import { destroySession } from '@/lib/auth';

export async function POST(): Promise<Response> {
  await destroySession();
  return Response.json({ ok: true });
}
```

- [ ] **Step 5: Rodar testes e build**

Run: `npm test` — Expected: PASS
Run: `npm run build` — Expected: build verde

- [ ] **Step 6: Commit**

```bash
git add lib/google-auth.ts lib/users.ts app/api/auth/ tests/google-auth.test.ts
git commit -m "feat: login com Google OAuth (state anti-CSRF, id_token via JWKS, upsert de usuário)"
```

---

### Task 8: Settings, eventos lazy e personagens (+ rotas)

**Files:**
- Create: `lib/settings.ts`, `lib/events.ts`, `lib/characters.ts`, `app/api/characters/route.ts`, `app/api/characters/[id]/route.ts`

**Interfaces:**
- Consumes: `computeNextWar`/`WarTimes` (Task 4), `query`/`queryOne`/`withTransaction`/`newId` (Task 5), `HttpError`/`requireUser`/`toResponse` (Task 6), `isValidCombo` (Task 2).
- Produces: `getWarTimes(): Promise<WarTimes>`; `ensureNextEvent(now?: Date): Promise<EventRow>` e `getEvent(id): Promise<EventRow | null>` com `EventRow = { id: string; tipo: WarTipo; data: Date }`; `listCharacters(userId): Promise<CharacterDTO[]>`, `createCharacter(userId, input): Promise<CharacterDTO>`, `updateCharacter(userId, id, input): Promise<CharacterDTO>` com `CharacterInput = { nome: string; classe: string; especializacao: string }`.

- [ ] **Step 1: Implementar settings e eventos**

`lib/settings.ts`:
```ts
import { query } from './db';
import type { WarTimes } from './war-schedule';

const DEFAULT_TIME = '21:00';

export async function getWarTimes(): Promise<WarTimes> {
  const rows = await query<{ key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key IN ('war_time_torre','war_time_noatum')",
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    TORRE: map['war_time_torre'] ?? DEFAULT_TIME,
    NOATUM: map['war_time_noatum'] ?? DEFAULT_TIME,
  };
}
```

`lib/events.ts`:
```ts
import { queryOne, newId } from './db';
import { computeNextWar } from './war-schedule';
import { getWarTimes } from './settings';
import type { WarTipo } from './types';

export interface EventRow {
  id: string;
  tipo: WarTipo;
  data: Date;
}

// Geração lazy: garante que a próxima guerra existe. Idempotente e à prova de
// concorrência via UNIQUE(dia) + ON CONFLICT DO NOTHING.
export async function ensureNextEvent(now: Date = new Date()): Promise<EventRow> {
  const times = await getWarTimes();
  const next = computeNextWar(now, times);
  await queryOne(
    `INSERT INTO events (id, tipo, data, dia) VALUES ($1, $2, $3, $4)
     ON CONFLICT (dia) DO NOTHING`,
    [newId(), next.tipo, next.dataUtc.toISOString(), next.dia],
  );
  const row = await queryOne<EventRow>('SELECT id, tipo, data FROM events WHERE dia = $1', [next.dia]);
  if (!row) throw new Error('Evento não encontrado após inserção.');
  return row;
}

export async function getEvent(id: string): Promise<EventRow | null> {
  return queryOne<EventRow>('SELECT id, tipo, data FROM events WHERE id = $1', [id]);
}
```

- [ ] **Step 2: Implementar personagens**

`lib/characters.ts`:
```ts
import { query, queryOne, withTransaction, newId } from './db';
import { HttpError } from './auth';
import { isValidCombo } from './wyd';
import type { CharacterDTO } from './types';

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
  const row = await queryOne<CharacterDTO>(
    `UPDATE characters SET nome = $3, classe = $4, especializacao = $5
     WHERE id = $1 AND user_id = $2
     RETURNING id, nome, classe, especializacao, principal`,
    [id, userId, nome, input.classe, input.especializacao],
  );
  if (!row) throw new HttpError(404, 'Personagem não encontrado.');
  return row;
}
```

- [ ] **Step 3: Rotas de personagens**

`app/api/characters/route.ts`:
```ts
import { requireUser, toResponse } from '@/lib/auth';
import { listCharacters, createCharacter } from '@/lib/characters';

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    return Response.json(await listCharacters(user.id));
  } catch (e) {
    return toResponse(e);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const user = await requireUser();
    const body = await req.json();
    const created = await createCharacter(user.id, body);
    return Response.json(created, { status: 201 });
  } catch (e) {
    return toResponse(e);
  }
}
```

`app/api/characters/[id]/route.ts`:
```ts
import { requireUser, toResponse } from '@/lib/auth';
import { updateCharacter } from '@/lib/characters';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();
    return Response.json(await updateCharacter(user.id, id, body));
  } catch (e) {
    return toResponse(e);
  }
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` — Expected: sem erros
Run: `npm run build` — Expected: build verde

- [ ] **Step 5: Commit**

```bash
git add lib/settings.ts lib/events.ts lib/characters.ts app/api/characters/
git commit -m "feat: eventos lazy, horários via settings e CRUD de personagens (máx 2)"
```

---

### Task 9: Confirmações, listas, summary, participação e pontos (+ rotas)

**Files:**
- Create: `lib/war.ts`, `app/api/war/current/route.ts`, `app/api/war/[id]/confirm/route.ts`, `app/api/war/[id]/list/route.ts`, `app/api/war/[id]/summary/route.ts`, `app/api/war/[id]/participation/route.ts`

**Interfaces:**
- Consumes: `getEvent`/`ensureNextEvent` (Task 8), `computeSummary` (Task 3), `listCharacters` (Task 8), auth (Task 6), db (Task 5).
- Produces: `confirmPresence(userId, eventId, status: string, characterId: string | null): Promise<void>`, `getMyConfirmation(userId, eventId): Promise<{ status: ConfirmStatus; character_id: string | null } | null>`, `getWarLists(eventId): Promise<WarListsDTO>`, `getWarSummary(eventId): Promise<Summary>`, `setParticipation(eventId, targetUserId, participou: boolean): Promise<void>`, `getUserPoints(userId): Promise<number>`.
- Payload de `GET /api/war/current`: `{ user: { nome, role, pontos }, event: { id, tipo, dataIso, locked }, myConfirmation: { status, characterId } | null, characters: CharacterDTO[] }`.
- Payload de `GET /api/war/[id]/summary` (flat, conforme escopo): `{ ...counts, TOTAL_FISICO, TOTAL_MAGO, alerts }`.

- [ ] **Step 1: Implementar lib/war.ts**

```ts
import { query, queryOne, newId } from './db';
import { HttpError } from './auth';
import { getEvent } from './events';
import { computeSummary, type Summary } from './summary';
import type { Classe, ConfirmStatus, Especializacao, ListEntry, WarListsDTO } from './types';

const STATUSES: ConfirmStatus[] = ['VOU', 'NAO_VOU', 'TALVEZ'];

async function getOpenEvent(eventId: string) {
  const event = await getEvent(eventId);
  if (!event) throw new HttpError(404, 'Guerra não encontrada.');
  return event;
}

export async function confirmPresence(
  userId: string,
  eventId: string,
  status: string,
  characterId: string | null,
): Promise<void> {
  if (!STATUSES.includes(status as ConfirmStatus)) throw new HttpError(400, 'Status inválido.');
  const event = await getOpenEvent(eventId);
  if (new Date() >= new Date(event.data)) {
    throw new HttpError(409, 'A guerra já começou — confirmações encerradas.');
  }

  let charId: string | null = null;
  if (status === 'VOU') {
    if (!characterId) throw new HttpError(400, 'Escolha um personagem para confirmar presença.');
    const owned = await queryOne('SELECT id FROM characters WHERE id = $1 AND user_id = $2', [characterId, userId]);
    if (!owned) throw new HttpError(403, 'Personagem não pertence a você.');
    charId = characterId;
  }

  await queryOne(
    `INSERT INTO confirmations (id, user_id, event_id, character_id, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, event_id)
     DO UPDATE SET status = EXCLUDED.status, character_id = EXCLUDED.character_id, updated_at = now()`,
    [newId(), userId, eventId, charId, status],
  );
}

export async function getMyConfirmation(userId: string, eventId: string) {
  return queryOne<{ status: ConfirmStatus; character_id: string | null }>(
    'SELECT status, character_id FROM confirmations WHERE user_id = $1 AND event_id = $2',
    [userId, eventId],
  );
}

interface ListRow {
  status: ConfirmStatus;
  user_id: string;
  nome: string;
  personagem: string | null;
  classe: string | null;
  especializacao: string | null;
  participou: boolean | null;
}

export async function getWarLists(eventId: string): Promise<WarListsDTO> {
  const rows = await query<ListRow>(
    `SELECT c.status, c.user_id, c.participou, u.nome,
            ch.nome AS personagem, ch.classe, ch.especializacao
     FROM confirmations c
     JOIN users u ON u.id = c.user_id
     LEFT JOIN characters ch ON ch.id = c.character_id
     WHERE c.event_id = $1
     ORDER BY c.updated_at`,
    [eventId],
  );
  const toEntry = (r: ListRow): ListEntry => ({
    userId: r.user_id,
    nome: r.nome,
    personagem: r.personagem,
    classe: r.classe as Classe | null,
    especializacao: r.especializacao as Especializacao | null,
    participou: r.participou,
  });
  return {
    vou: rows.filter((r) => r.status === 'VOU').map(toEntry),
    talvez: rows.filter((r) => r.status === 'TALVEZ').map(toEntry),
    nao_vou: rows.filter((r) => r.status === 'NAO_VOU').map(toEntry),
  };
}

export async function getWarSummary(eventId: string): Promise<Summary> {
  const rows = await query<{ classe: string; especializacao: string }>(
    `SELECT ch.classe, ch.especializacao
     FROM confirmations c
     JOIN characters ch ON ch.id = c.character_id
     WHERE c.event_id = $1 AND c.status = 'VOU'`,
    [eventId],
  );
  return computeSummary(rows);
}

export async function setParticipation(eventId: string, targetUserId: string, participou: boolean): Promise<void> {
  const event = await getOpenEvent(eventId);
  if (new Date() < new Date(event.data)) {
    throw new HttpError(409, 'A guerra ainda não começou — check de participação indisponível.');
  }
  const row = await queryOne(
    `UPDATE confirmations SET participou = $3
     WHERE event_id = $1 AND user_id = $2 AND status = 'VOU'
     RETURNING id`,
    [eventId, targetUserId, participou],
  );
  if (!row) throw new HttpError(404, 'Confirmação não encontrada.');
}

// Pontos derivados: +5 por confirmação VOU, +5 por participação validada.
export async function getUserPoints(userId: string): Promise<number> {
  const row = await queryOne<{ pontos: number }>(
    `SELECT (5 * COUNT(*) FILTER (WHERE status = 'VOU')
           + 5 * COUNT(*) FILTER (WHERE participou IS TRUE))::int AS pontos
     FROM confirmations WHERE user_id = $1`,
    [userId],
  );
  return row?.pontos ?? 0;
}
```

- [ ] **Step 2: Rotas**

`app/api/war/current/route.ts`:
```ts
import { requireUser, toResponse } from '@/lib/auth';
import { ensureNextEvent } from '@/lib/events';
import { getMyConfirmation, getUserPoints } from '@/lib/war';
import { listCharacters } from '@/lib/characters';

export async function GET(): Promise<Response> {
  try {
    const user = await requireUser();
    const event = await ensureNextEvent();
    const [mine, characters, pontos] = await Promise.all([
      getMyConfirmation(user.id, event.id),
      listCharacters(user.id),
      getUserPoints(user.id),
    ]);
    return Response.json({
      user: { nome: user.nome, role: user.role, pontos },
      event: {
        id: event.id,
        tipo: event.tipo,
        dataIso: new Date(event.data).toISOString(),
        locked: new Date() >= new Date(event.data),
      },
      myConfirmation: mine ? { status: mine.status, characterId: mine.character_id } : null,
      characters,
    });
  } catch (e) {
    return toResponse(e);
  }
}
```

`app/api/war/[id]/confirm/route.ts`:
```ts
import { requireUser, toResponse } from '@/lib/auth';
import { confirmPresence } from '@/lib/war';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json()) as { status?: string; characterId?: string | null };
    await confirmPresence(user.id, id, body.status ?? '', body.characterId ?? null);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
```

`app/api/war/[id]/list/route.ts`:
```ts
import { requireUser, toResponse } from '@/lib/auth';
import { getWarLists } from '@/lib/war';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireUser();
    const { id } = await ctx.params;
    return Response.json(await getWarLists(id));
  } catch (e) {
    return toResponse(e);
  }
}
```

`app/api/war/[id]/summary/route.ts`:
```ts
import { requireAdmin, toResponse } from '@/lib/auth';
import { getWarSummary } from '@/lib/war';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const s = await getWarSummary(id);
    // Formato flat conforme o escopo: { BM_FISICO: 5, ..., TOTAL_FISICO, TOTAL_MAGO, alerts }
    return Response.json({ ...s.counts, TOTAL_FISICO: s.TOTAL_FISICO, TOTAL_MAGO: s.TOTAL_MAGO, alerts: s.alerts });
  } catch (e) {
    return toResponse(e);
  }
}
```

`app/api/war/[id]/participation/route.ts`:
```ts
import { requireAdmin, toResponse } from '@/lib/auth';
import { setParticipation } from '@/lib/war';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = (await req.json()) as { userId?: string; participou?: boolean };
    if (!body.userId || typeof body.participou !== 'boolean') {
      return Response.json({ error: 'userId e participou são obrigatórios.' }, { status: 400 });
    }
    await setParticipation(id, body.userId, body.participou);
    return Response.json({ ok: true });
  } catch (e) {
    return toResponse(e);
  }
}
```

- [ ] **Step 3: Verificar**

Run: `npm test` — Expected: PASS
Run: `npm run build` — Expected: build verde

- [ ] **Step 4: Commit**

```bash
git add lib/war.ts app/api/war/
git commit -m "feat: confirmações, listas, summary tático, participação e pontos derivados"
```

---

### Task 10: Frontend — api-client, shell e login

**Files:**
- Create: `lib/api-client.ts`, `components/GuerraApp.tsx`, `components/LoginView.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `GET /api/war/current` (Task 9).
- Produces: `api<T>(path, init?): Promise<T>` lançando `ApiError` com `.status`; tipo `CurrentData = { user: { nome: string; role: Role; pontos: number }; event: { id: string; tipo: WarTipo; dataIso: string; locked: boolean }; myConfirmation: { status: ConfirmStatus; characterId: string | null } | null; characters: CharacterDTO[] }` (exportado de `components/GuerraApp.tsx`).

- [ ] **Step 1: api-client**

`lib/api-client.ts`:
```ts
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) msg = body.error;
    } catch {
      // corpo não-JSON: mantém mensagem genérica
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: LoginView e GuerraApp**

`components/LoginView.tsx`:
```tsx
export default function LoginView({ loginFailed }: { loginFailed: boolean }) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-wide">⚔️ Guerra</h1>
        <p className="mt-2 text-slate-400">Presença da guild nas guerras do WYD</p>
      </div>
      {loginFailed && (
        <p className="rounded-lg bg-red-950 px-4 py-2 text-sm text-red-300">
          Falha no login. Tente novamente.
        </p>
      )}
      <a
        href="/api/auth/google"
        className="rounded-xl bg-white px-8 py-4 text-lg font-semibold text-slate-900 active:scale-95"
      >
        Entrar com Google
      </a>
    </main>
  );
}
```

`components/GuerraApp.tsx`:
```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import type { CharacterDTO, ConfirmStatus, Role, WarTipo } from '@/lib/types';
import LoginView from './LoginView';
import CharacterWizard from './CharacterWizard';
import WarScreen from './WarScreen';

export interface CurrentData {
  user: { nome: string; role: Role; pontos: number };
  event: { id: string; tipo: WarTipo; dataIso: string; locked: boolean };
  myConfirmation: { status: ConfirmStatus; characterId: string | null } | null;
  characters: CharacterDTO[];
}

type State = { kind: 'loading' } | { kind: 'anon' } | { kind: 'ready'; data: CurrentData };

export default function GuerraApp() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [loginFailed, setLoginFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<CurrentData>('/api/war/current');
      setState({ kind: 'ready', data });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setState({ kind: 'anon' });
      else setState({ kind: 'anon' });
    }
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('erro') === 'login') {
      setLoginFailed(true);
      window.history.replaceState(null, '', '/');
    }
    void load();
  }, [load]);

  if (state.kind === 'loading') {
    return <main className="min-h-dvh flex items-center justify-center text-slate-400">Carregando…</main>;
  }
  if (state.kind === 'anon') return <LoginView loginFailed={loginFailed} />;
  if (state.data.characters.length === 0) {
    return <CharacterWizard onDone={load} />;
  }
  return <WarScreen data={state.data} reload={load} />;
}
```

`app/page.tsx`:
```tsx
import GuerraApp from '@/components/GuerraApp';

export default function Page() {
  return <GuerraApp />;
}
```

- [ ] **Step 3: Stubs temporários para compilar**

Até as Tasks 11–12, criar stubs mínimos (serão substituídos):

`components/CharacterWizard.tsx`:
```tsx
'use client';

export default function CharacterWizard({ onDone }: { onDone: () => void }) {
  void onDone;
  return <main className="p-6">Cadastro de personagem (Task 11)</main>;
}
```

`components/WarScreen.tsx`:
```tsx
'use client';

import type { CurrentData } from './GuerraApp';

export default function WarScreen({ data, reload }: { data: CurrentData; reload: () => Promise<void> }) {
  void reload;
  return <main className="p-6">Guerra {data.event.tipo} (Task 12)</main>;
}
```

- [ ] **Step 4: Verificar**

Run: `npm run build` — Expected: build verde
Run: `npm test` — Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/api-client.ts components/ app/page.tsx
git commit -m "feat: shell do app, tela de login com Google e api-client"
```

---

### Task 11: Frontend — cadastro e gestão de personagens

**Files:**
- Modify: `components/CharacterWizard.tsx` (substituir stub)
- Create: `components/CharacterForm.tsx`

**Interfaces:**
- Consumes: `POST /api/characters` e `PATCH /api/characters/[id]` (Task 8), `SPECS_BY_CLASS`/`SPEC_LABELS`/`CLASSES` (Task 2), `api` (Task 10).
- Produces: `CharacterWizard({ onDone })` — primeiro acesso; `CharacterForm({ initial?, onSaved, onCancel? })` — formulário reutilizado no wizard e na edição (Task 12 usa para "Meus personagens").

- [ ] **Step 1: Formulário compartilhado**

`components/CharacterForm.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { CLASSES, SPECS_BY_CLASS, SPEC_LABELS } from '@/lib/wyd';
import type { CharacterDTO, Classe, Especializacao } from '@/lib/types';

interface Props {
  initial?: CharacterDTO;
  onSaved: () => void;
  onCancel?: () => void;
}

export default function CharacterForm({ initial, onSaved, onCancel }: Props) {
  const [nome, setNome] = useState(initial?.nome ?? '');
  const [classe, setClasse] = useState<Classe | null>(initial?.classe ?? null);
  const [espec, setEspec] = useState<Especializacao | null>(initial?.especializacao ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const specs = classe ? SPECS_BY_CLASS[classe] : [];

  function pickClasse(c: Classe) {
    setClasse(c);
    // HT só tem Físico: já seleciona; senão limpa para forçar escolha válida.
    setEspec(SPECS_BY_CLASS[c].length === 1 ? SPECS_BY_CLASS[c][0] : null);
  }

  async function save() {
    if (!classe || !espec) return;
    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await api(`/api/characters/${initial.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ nome, classe, especializacao: espec }),
        });
      } else {
        await api('/api/characters', {
          method: 'POST',
          body: JSON.stringify({ nome, classe, especializacao: espec }),
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  const canSave = nome.trim().length >= 2 && !!classe && !!espec && !saving;

  return (
    <div className="flex flex-col gap-4">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome do personagem"
        maxLength={30}
        className="rounded-xl bg-slate-800 px-4 py-3 text-lg outline-none focus:ring-2 focus:ring-amber-400"
      />
      <div>
        <p className="mb-2 text-sm text-slate-400">Classe</p>
        <div className="grid grid-cols-4 gap-2">
          {CLASSES.map((c) => (
            <button
              key={c}
              onClick={() => pickClasse(c)}
              className={`rounded-xl py-3 text-lg font-bold ${classe === c ? 'bg-amber-400 text-slate-900' : 'bg-slate-800'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      {classe && specs.length > 1 && (
        <div>
          <p className="mb-2 text-sm text-slate-400">Especialização</p>
          <div className="grid grid-cols-3 gap-2">
            {specs.map((s) => (
              <button
                key={s}
                onClick={() => setEspec(s)}
                className={`rounded-xl py-3 font-semibold ${espec === s ? 'bg-amber-400 text-slate-900' : 'bg-slate-800'}`}
              >
                {SPEC_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        {onCancel && (
          <button onClick={onCancel} className="flex-1 rounded-xl bg-slate-800 py-3">
            Cancelar
          </button>
        )}
        <button
          onClick={save}
          disabled={!canSave}
          className="flex-1 rounded-xl bg-emerald-500 py-3 text-lg font-bold text-slate-950 disabled:opacity-40"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wizard de primeiro acesso**

`components/CharacterWizard.tsx` (substitui o stub):
```tsx
'use client';

import CharacterForm from './CharacterForm';

export default function CharacterWizard({ onDone }: { onDone: () => void }) {
  return (
    <main className="mx-auto min-h-dvh max-w-md p-6">
      <h1 className="text-2xl font-bold">Cadastre seu personagem</h1>
      <p className="mb-6 mt-1 text-slate-400">Rapidinho: nome, classe e especialização.</p>
      <CharacterForm onSaved={onDone} />
    </main>
  );
}
```

- [ ] **Step 3: Verificar**

Run: `npm run build` — Expected: build verde

- [ ] **Step 4: Commit**

```bash
git add components/CharacterForm.tsx components/CharacterWizard.tsx
git commit -m "feat: cadastro de personagem por botões com combos válidos"
```

---

### Task 12: Frontend — tela da guerra (botões, countdown, listas, polling)

**Files:**
- Modify: `components/WarScreen.tsx` (substituir stub)
- Create: `components/CharPicker.tsx`, `components/WarLists.tsx`, `components/Countdown.tsx`

**Interfaces:**
- Consumes: `POST /api/war/[id]/confirm`, `GET /api/war/[id]/list` (Task 9), `CurrentData` (Task 10), `CharacterForm` (Task 11), `TIPO_LABELS`/`SPEC_LABELS` (Task 2).
- Produces: `WarScreen({ data, reload })`; `CharPicker({ characters, preselectedId, onPick, onClose })`; `WarLists({ lists, leaderMode?, locked?, onParticipation? })` (leaderMode usado na Task 13); `Countdown({ targetIso })`.
- Polling: `GET /api/war/[id]/list` a cada 8000 ms (`POLL_MS = 8000`).

- [ ] **Step 1: Countdown**

`components/Countdown.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';

function fmt(msLeft: number): string {
  if (msLeft <= 0) return 'AGORA';
  const s = Math.floor(msLeft / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function Countdown({ targetIso }: { targetIso: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return <span className="font-mono text-2xl font-bold text-amber-300">{fmt(new Date(targetIso).getTime() - now)}</span>;
}
```

- [ ] **Step 2: CharPicker (bottom-sheet)**

`components/CharPicker.tsx`:
```tsx
'use client';

import { SPEC_LABELS } from '@/lib/wyd';
import type { CharacterDTO } from '@/lib/types';

interface Props {
  characters: CharacterDTO[];
  preselectedId: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}

export default function CharPicker({ characters, preselectedId, onPick, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div className="w-full rounded-t-2xl bg-slate-900 p-6 pb-10" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold">Com qual personagem?</h2>
        <div className="flex flex-col gap-3">
          {characters.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className={`flex items-center justify-between rounded-xl px-4 py-4 text-left ${
                c.id === preselectedId ? 'bg-amber-400 text-slate-900' : 'bg-slate-800'
              }`}
            >
              <span className="text-lg font-semibold">{c.nome}</span>
              <span className="text-sm opacity-80">
                {c.classe} {SPEC_LABELS[c.especializacao]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Listas**

`components/WarLists.tsx`:
```tsx
'use client';

import { SPEC_LABELS } from '@/lib/wyd';
import type { ListEntry, WarListsDTO } from '@/lib/types';

interface Props {
  lists: WarListsDTO;
  leaderMode?: boolean;
  locked?: boolean;
  onParticipation?: (userId: string, participou: boolean) => void;
}

function Row({ e, leaderMode, locked, onParticipation }: { e: ListEntry } & Omit<Props, 'lists'>) {
  return (
    <li className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2">
      <div>
        <span className="font-medium">{e.nome}</span>
        {e.personagem && (
          <span className="ml-2 text-sm text-slate-400">
            {e.personagem} · {e.classe} {e.especializacao ? SPEC_LABELS[e.especializacao] : ''}
          </span>
        )}
      </div>
      {leaderMode && locked && onParticipation && (
        <button
          onClick={() => onParticipation(e.userId, !(e.participou ?? false))}
          className={`rounded-lg px-3 py-1 text-sm font-semibold ${
            e.participou ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
          }`}
        >
          {e.participou ? '✔ Participou' : 'Marcar'}
        </button>
      )}
    </li>
  );
}

function Section({ title, entries, ...rest }: { title: string; entries: ListEntry[] } & Omit<Props, 'lists'>) {
  if (entries.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {title} ({entries.length})
      </h3>
      <ul className="flex flex-col gap-1">
        {entries.map((e) => (
          <Row key={e.userId} e={e} {...rest} />
        ))}
      </ul>
    </section>
  );
}

export default function WarLists({ lists, leaderMode, locked, onParticipation }: Props) {
  const rest = { leaderMode, locked, onParticipation };
  return (
    <div>
      <Section title="✅ Confirmados" entries={lists.vou} {...rest} />
      <Section title="⏳ Talvez" entries={lists.talvez} {...rest} />
      <Section title="❌ Não vão" entries={lists.nao_vou} {...rest} />
    </div>
  );
}
```

- [ ] **Step 4: WarScreen**

`components/WarScreen.tsx` (substitui o stub):
```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { TIPO_LABELS } from '@/lib/wyd';
import type { ConfirmStatus, WarListsDTO } from '@/lib/types';
import type { CurrentData } from './GuerraApp';
import Countdown from './Countdown';
import CharPicker from './CharPicker';
import WarLists from './WarLists';
import CharacterForm from './CharacterForm';
import LeaderPanel from './LeaderPanel';

const POLL_MS = 8000;

export default function WarScreen({ data, reload }: { data: CurrentData; reload: () => Promise<void> }) {
  const { user, event, myConfirmation, characters } = data;
  const [lists, setLists] = useState<WarListsDTO>({ vou: [], talvez: [], nao_vou: [] });
  const [picking, setPicking] = useState(false);
  const [managing, setManaging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    try {
      setLists(await api<WarListsDTO>(`/api/war/${event.id}/list`));
    } catch {
      // polling: falha silenciosa, próxima rodada tenta de novo
    }
  }, [event.id]);

  useEffect(() => {
    void loadLists();
    const t = setInterval(() => void loadLists(), POLL_MS);
    return () => clearInterval(t);
  }, [loadLists]);

  async function send(status: ConfirmStatus, characterId: string | null) {
    setError(null);
    try {
      await api(`/api/war/${event.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ status, characterId }),
      });
      await Promise.all([reload(), loadLists()]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro ao confirmar.');
    }
  }

  function onVou() {
    if (characters.length === 1) {
      void send('VOU', characters[0].id);
      return;
    }
    setPicking(true);
  }

  const preselected =
    myConfirmation?.characterId ?? characters.find((c) => c.principal)?.id ?? null;

  const dataLocal = new Date(event.dataIso).toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

  const btn = (active: boolean, color: string) =>
    `rounded-2xl py-5 text-lg font-bold active:scale-95 disabled:opacity-40 ${active ? color : 'bg-slate-800'}`;

  return (
    <main className="mx-auto min-h-dvh max-w-md p-4 pb-16">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">Olá, {user.nome}</p>
          <p className="text-xs text-amber-300">{user.pontos} pontos</p>
        </div>
        <button onClick={() => setManaging(true)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm">
          Meus personagens
        </button>
      </header>

      <section className="rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 p-5 text-center">
        <h1 className="text-xl font-bold">{TIPO_LABELS[event.tipo]}</h1>
        <p className="mt-1 text-sm capitalize text-slate-400">{dataLocal}</p>
        <div className="mt-3">
          <Countdown targetIso={event.dataIso} />
        </div>
      </section>

      {event.locked ? (
        <p className="mt-4 rounded-xl bg-slate-800 p-4 text-center text-slate-300">
          ⚔️ Guerra em andamento — confirmações encerradas.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button className={btn(myConfirmation?.status === 'VOU', 'bg-emerald-500 text-slate-950')} onClick={onVou}>
            ✅ Vou
          </button>
          <button
            className={btn(myConfirmation?.status === 'NAO_VOU', 'bg-red-500 text-slate-950')}
            onClick={() => void send('NAO_VOU', null)}
          >
            ❌ Não vou
          </button>
          <button
            className={btn(myConfirmation?.status === 'TALVEZ', 'bg-amber-400 text-slate-900')}
            onClick={() => void send('TALVEZ', null)}
          >
            ⏳ Talvez
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-center text-sm text-red-400">{error}</p>}

      {user.role === 'ADMIN' && (
        <LeaderPanel
          eventId={event.id}
          locked={event.locked}
          lists={lists}
          onParticipationChanged={loadLists}
        />
      )}

      <WarLists lists={lists} />

      {picking && (
        <CharPicker
          characters={characters}
          preselectedId={preselected}
          onPick={(id) => {
            setPicking(false);
            void send('VOU', id);
          }}
          onClose={() => setPicking(false)}
        />
      )}

      {managing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950 p-6">
          <h2 className="mb-4 text-xl font-bold">Meus personagens</h2>
          {characters.map((c) => (
            <div key={c.id} className="mb-6 rounded-xl bg-slate-900 p-4">
              <CharacterForm initial={c} onSaved={() => { setManaging(false); void reload(); }} />
            </div>
          ))}
          {characters.length < 2 && (
            <div className="mb-6 rounded-xl bg-slate-900 p-4">
              <p className="mb-3 text-sm text-slate-400">Adicionar 2º personagem</p>
              <CharacterForm onSaved={() => { setManaging(false); void reload(); }} />
            </div>
          )}
          <button onClick={() => setManaging(false)} className="w-full rounded-xl bg-slate-800 py-3">
            Fechar
          </button>
          <div className="mt-6 text-center">
            <button
              onClick={() => void api('/api/auth/logout', { method: 'POST' }).then(() => window.location.reload())}
              className="text-sm text-slate-500 underline"
            >
              Sair da conta
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Stub do LeaderPanel (Task 13 substitui)**

`components/LeaderPanel.tsx`:
```tsx
'use client';

import type { WarListsDTO } from '@/lib/types';

interface Props {
  eventId: string;
  locked: boolean;
  lists: WarListsDTO;
  onParticipationChanged: () => Promise<void>;
}

export default function LeaderPanel(props: Props) {
  void props;
  return null;
}
```

- [ ] **Step 6: Verificar**

Run: `npm run build` — Expected: build verde
Run: `npm test` — Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add components/
git commit -m "feat: tela da guerra — botões grandes, countdown, seleção de personagem e listas com polling"
```

---

### Task 13: Frontend — painel do líder (composição, alertas, participação)

**Files:**
- Modify: `components/LeaderPanel.tsx` (substituir stub)

**Interfaces:**
- Consumes: `GET /api/war/[id]/summary` (flat: `{ ...counts, TOTAL_FISICO, TOTAL_MAGO, alerts }`), `POST /api/war/[id]/participation` (`{ userId, participou }`), `WarLists` com `leaderMode` (Task 12).
- Produces: `LeaderPanel({ eventId, locked, lists, onParticipationChanged })`.

- [ ] **Step 1: Implementar**

`components/LeaderPanel.tsx` (substitui o stub):
```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import type { WarListsDTO } from '@/lib/types';
import WarLists from './WarLists';

const POLL_MS = 8000;

type SummaryFlat = Record<string, number | string[]> & { alerts: string[] };

interface Props {
  eventId: string;
  locked: boolean;
  lists: WarListsDTO;
  onParticipationChanged: () => Promise<void>;
}

export default function LeaderPanel({ eventId, locked, lists, onParticipationChanged }: Props) {
  const [summary, setSummary] = useState<SummaryFlat | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await api<SummaryFlat>(`/api/war/${eventId}/summary`));
    } catch {
      // polling: falha silenciosa
    }
  }, [eventId]);

  useEffect(() => {
    void loadSummary();
    const t = setInterval(() => void loadSummary(), POLL_MS);
    return () => clearInterval(t);
  }, [loadSummary]);

  async function toggleParticipation(userId: string, participou: boolean) {
    try {
      await api(`/api/war/${eventId}/participation`, {
        method: 'POST',
        body: JSON.stringify({ userId, participou }),
      });
      await onParticipationChanged();
    } catch {
      // erro pontual: próximo polling corrige a visão
    }
  }

  if (!summary) return null;

  const combos = Object.entries(summary).filter(
    ([k, v]) => typeof v === 'number' && k !== 'TOTAL_FISICO' && k !== 'TOTAL_MAGO',
  ) as [string, number][];

  return (
    <section className="mt-4 rounded-2xl border border-amber-400/30 bg-slate-900 p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-amber-300">Visão do líder</h2>

      {summary.alerts.length > 0 && (
        <div className="mb-3 flex flex-col gap-1">
          {summary.alerts.map((a) => (
            <p key={a} className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
              ⚠️ {a}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        {combos.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-slate-800 p-2">
            <p className="text-xs text-slate-400">{k.replace('_', ' ')}</p>
            <p className="text-lg font-bold">{v}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-slate-800 p-2">
          <p className="text-xs text-slate-400">TOTAL FÍSICO</p>
          <p className="text-lg font-bold">{summary.TOTAL_FISICO as number}</p>
        </div>
        <div className="rounded-lg bg-slate-800 p-2">
          <p className="text-xs text-slate-400">TOTAL MAGO</p>
          <p className="text-lg font-bold">{summary.TOTAL_MAGO as number}</p>
        </div>
      </div>

      {locked && lists.vou.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Check de participação (+5 pts)</h3>
          <WarLists
            lists={{ vou: lists.vou, talvez: [], nao_vou: [] }}
            leaderMode
            locked
            onParticipation={(userId, p) => void toggleParticipation(userId, p)}
          />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verificar**

Run: `npm run build` — Expected: build verde
Run: `npm test` — Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add components/LeaderPanel.tsx
git commit -m "feat: painel do líder — composição, alertas e check de participação"
```

---

### Task 14: README + verificação final local

**Files:**
- Create: `README.md`

- [ ] **Step 1: README**

`README.md`:
```markdown
# Guerra — Presença Tática da Guild (WYD)

App mobile-first para confirmar presença nas guerras da guild e dar ao líder
visão tática da composição (classes/especializações) antes da batalha.

## Stack

Next.js 16 (App Router, TS) · Tailwind v4 · PostgreSQL (Neon) · Google OAuth · Vercel

## Rodando local

1. `cp .env.example .env.local` e preencher:
   - `DATABASE_URL` — Postgres (Neon)
   - `JWT_SECRET` — `openssl rand -hex 32`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — credencial OAuth (Web) no Google Cloud Console
     com redirect `http://localhost:3000/api/auth/google/callback`
   - `APP_URL=http://localhost:3000`
2. `npm install`
3. `npm run db:init` — aplica o schema (idempotente)
4. `npm run dev`

## Comandos

| Comando | Função |
|---|---|
| `npm run db:init` | Aplica `lib/schema.sql` |
| `npm run promote -- <email>` | Promove usuário a líder (ADMIN) |
| `npm test` | Testes de domínio (vitest) |

## Regras do domínio

- Classes: TK, BM, HT, FM. Especializações: TK/BM → Físico, Mago · HT → Físico · FM → Cancel, Blood, Mago.
- Máx. 2 personagens por usuário.
- Guerras: Seg–Sex Torre, Dom Noatum (21:00 padrão; `settings.war_time_torre` / `war_time_noatum`).
- Pontos: +5 confirmou (Vou), +5 participou (validado pelo líder). Derivados, sem coluna.
- Confirmações travam no horário da guerra.
```

- [ ] **Step 2: Verificação final**

Run: `npm test` — Expected: PASS (todas as suítes: wyd, summary, war-schedule, session-token, google-auth, smoke)
Run: `npm run build` — Expected: build verde
Run: `npx tsc --noEmit` — Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README com setup, comandos e regras de domínio"
```

---

### Task 15: Infra + smoke test ponta a ponta (com o Ruan)

**Pré-requisitos que dependem do Ruan (coletar antes de começar):**
1. **Banco Neon**: criar database novo (projeto `guerra`, região sa-east-1) e copiar a connection string.
2. **Google Cloud Console**: criar OAuth Client (tipo Web) com redirects `http://localhost:3000/api/auth/google/callback` (dev) e depois o da Vercel; copiar Client ID/Secret. Adicionar o e-mail do Ruan como test user (consent em Testing).
3. (Deploy) Repo GitHub + projeto Vercel.

- [ ] **Step 1: Configurar `.env.local`** (DATABASE_URL, JWT_SECRET gerado, GOOGLE_CLIENT_ID/SECRET, APP_URL=http://localhost:3000)

- [ ] **Step 2: Aplicar schema**

Run: `npm run db:init` — Expected: "Schema aplicado com sucesso."

- [ ] **Step 3: Smoke test dev**

Run: `npm run dev` e validar no navegador (mobile viewport):
1. `/` sem sessão → botão "Entrar com Google".
2. Login Google → volta logado → wizard de personagem.
3. Cadastrar personagem (ex.: FM Blood) → tela da guerra com evento correto do dia (Torre seg–sex 21:00 / Noatum dom) e countdown.
4. Clicar "✅ Vou" → aparece em Confirmados (com classe/espec). Trocar para "⏳ Talvez" → muda de lista.
5. Cadastrar 2º personagem → "Vou" abre o bottom-sheet; 3º personagem → erro 409.
6. `npm run promote -- <email-do-ruan>` → recarregar → "Visão do líder" com composição + alertas.
7. Segundo navegador/perfil → segunda conta Google → confirmar → lista atualiza no primeiro em ≤8s.
8. Ajustar `settings.war_time_torre` para horário já passado (`UPDATE settings ...` ou INSERT) → evento trava confirmações e libera check de participação; marcar participou → +5 pontos no usuário.

- [ ] **Step 4: Deploy**

1. Criar repo GitHub (privado) `guerra` e push.
2. Importar na Vercel; setar env vars (`DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL=https://<url-vercel>`). **Lembrete (gotcha conhecido):** setar env vars pelo dashboard ou via Git Bash `printf '%s' "$val" | vercel env add NAME production` — o pipe do PowerShell entrega valor vazio.
3. Adicionar redirect URI de produção no Google Cloud Console.
4. Repetir smoke test em produção.

- [ ] **Step 5: Commit final e registro**

```bash
git add -A
git commit -m "chore: ajustes finais do smoke test"
```

---

## Fora do plano (registrado para depois)

- Ranking visível (os pontos já são deriváveis por SELECT).
- Tela do líder para editar horários das guerras (por ora: UPDATE direto em `settings`).
- Publicar o consent screen do Google (sair do modo Testing) quando a guild toda for usar.
