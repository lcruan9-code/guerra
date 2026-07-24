# Guerra — SET do personagem & Gear Score (ranking de força)

**Data:** 2026-07-24
**Status:** aprovado (design) — aguardando revisão do spec

## 1. Objetivo

Dar a cada **personagem** um "set" (equipamento) que o jogador monta numa tela
visual no estilo da janela de **Equipamento do WYD**, e derivar disso um
**gear score de 0 a 48**. O líder usa o ranking de gear score para montar a
composição da guerra (quem está mais forte, quem precisa evoluir). Cada jogador
vê só o próprio score; o líder vê o ranking de todos.

Requisito visual firme: **a tela do SET deve ficar bem próxima do print da
janela de equipamento do WYD** — é parte da entrega, não só função.

## 2. Regras de pontuação (domínio travado)

16 slots. Slot vazio / item abaixo do mínimo = **0 pontos**. Máximo = **48**.

| # | Slot | Pontua por | Regra | Máx |
|---|------|------------|-------|-----|
| 1 | Cavalo / pet | nível | lvl 120 = 1 · lvl 150 = 2 · não tem = 0 | 2 |
| 2 | Cythera (elmo) | add **+** refino | add sux/semi/full = 1/2/3 · refino +13/+14/+15 = 1/2/3 (abaixo de +13 = 0) | 6 |
| 3 | Armadura | refino | +13/+14/+15 = 1/2/3 (abaixo = 0) | 3 |
| 4 | Calça | refino | +13/+14/+15 = 1/2/3 | 3 |
| 5 | Luvas | refino | +13/+14/+15 = 1/2/3 | 3 |
| 6 | Botas | refino | +13/+14/+15 = 1/2/3 | 3 |
| 7 | Arma | refino | +13/+14/+15 = 1/2/3 (add da arma é sempre full → não pontua extra) | 3 |
| 8 | Escudo | refino | +13/+14/+15 = 1/2/3 | 3 |
| 9 | Capa | refino **+** add | refino +0/+9/+11 = 0/1/2 · add sux/semi/full = 1/2/3 | 5 |
| 10 | Runa (braço) | refino | não tem = 0 · +1–5 = 1 · +6–9 = 2 | 2 |
| 11–13 | Amuletos ×3 (sempre +9) | add | cada: sux/semi/full = 1/2/3 | 9 |
| 14 | Anel | tipo | T1 = 1 · T2 = 2 · não tem = 0 | 2 |
| 15 | Brinco | tipo | T1 = 1 · T2 = 2 · não tem = 0 | 2 |
| 16 | Cinto | tipo | T1 = 1 · T2 = 2 · não tem = 0 | 2 |

Escalas discretas usadas nos seletores:
- **Refino (set/arma/escudo/cythera):** `< +13` (0) · `+13` · `+14` · `+15`.
- **Refino da capa:** `+0` (0) · `+9` (1) · `+11` (2).
- **Runa:** `não tem` (0) · `+1–5` (1) · `+6–9` (2).
- **Add:** `sux` (1) · `semi` (2) · `full` (3). Não existe estado "sem add"; quando o
  item existe, o add é um desses três. Amuleto pode ser `não tem` (slot vazio = 0).
- **Tipo (anel/brinco/cinto):** `não tem` (0) · `T1` (1) · `T2` (2).
- **Pet:** `não tem` (0) · `lvl 120` (1) · `lvl 150` (2).

## 3. Modelo de dados

Equipamento pertence ao **personagem** (não ao usuário — cada char tem o seu set).

- Nova coluna **`characters.equipment JSONB`** (nullable). Guarda o set inteiro,
  lido/gravado de uma vez. Migração idempotente em `lib/schema.sql`:
  `ALTER TABLE characters ADD COLUMN IF NOT EXISTS equipment JSONB;`
- **Sem coluna de score.** Segue a filosofia do app (pontos de guerra são
  derivados): o gear score é calculado por função pura a partir do JSON.

Shape do JSON (tipado em `lib/types.ts`):

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
  runa?: { refino?: number | null }; // null / ausente = não tem
  amuletos?: (AddTier | null)[];     // até 3 posições; null = slot vazio
  anel?: Tipo | null;
  brinco?: Tipo | null;
  cinto?: Tipo | null;
}
```

Campos ausentes/`null` = slot vazio = 0 ponto. Um personagem sem `equipment`
tem score 0 (set opcional).

## 4. Cálculo do score — `lib/gear.ts` (novo)

Módulo puro, sem I/O, testável isoladamente com vitest.

- `SLOTS` — metadados dos 16 slots (chave, label, tipo de picker, ordem, posição
  no grid) — fonte única usada pela tela e pelo cálculo.
- `gearScore(eq: Equipment | null): number` — total 0–48.
- `slotBreakdown(eq: Equipment | null): { slot, label, pontos }[]` — detalhe por
  slot (para o modal de detalhe do ranking e o valor por card na tela).
- Constantes das regras (refino→pontos, add→pontos, tipo→pontos, pet→pontos).
- `GEAR_MAX = 48` derivado das regras (não hardcoded solto).

## 5. Tela do SET — `EquipmentGrid` (novo componente)

Aberta pelo botão **SET** em cada personagem já salvo, no sheet "Meus
personagens" (`WarScreen.tsx`, bloco do `CharacterForm` com `initial={c}`).
O botão só aparece em personagem com `id` (o 2º personagem em cadastro ganha o
SET depois de salvo).

Layout: **grade espelhando a janela de Equipamento do WYD** (referência: o
screenshot enviado pelo usuário — ver §9). Cada slot é um card com:
- ícone/label do slot,
- badge do valor atual (ex.: `+15`, `full`, `T2`, `lvl150`, ou vazio),
- pontos do slot (ex.: `3`).

Toque no slot → **bottom-sheet** (padrão `.sheet-overlay`/`.sheet` já existente)
com o seletor adequado ao tipo:

| Tipo de slot | Slots | Seletor |
|--------------|-------|---------|
| refino simples | armadura, calça, luvas, botas, arma, escudo | `< +13 / +13 / +14 / +15` |
| refino + add | cythera | refino (`< +13/+13/+14/+15`) + add (`sux/semi/full`) |
| capa | capa | refino (`+0/+9/+11`) + add (`sux/semi/full`) |
| runa | runa | `não tem / +1–5 / +6–9` |
| add | amuleto 1/2/3 | `não tem / sux / semi / full` |
| tipo | anel, brinco, cinto | `não tem / T1 / T2` |
| pet | cavalo/pet | `não tem / lvl 120 / lvl 150` |

Topo da tela: **GEAR SCORE X/48** ao vivo (recalculado no cliente a cada
alteração via `gearScore`). Botão **Salvar** persiste o JSON inteiro. Estado
local é editável à vontade e só grava ao salvar. Sem trava de horário (é gear,
não presença) — editável a qualquer momento.

Estilo: reaproveita o tema WYD já em `app/globals.css` (Cinzel/Rajdhani, paleta
laranja/vermelho, bordas por classe). Cores de refino/add podem sinalizar nível
(ex.: +15 e full destacados) para reforçar o clima do jogo.

## 6. Ranking do líder + score do jogador

- **Líder** — nova aba **"Força"** no `AdminPanel` (padrão de abas já existe:
  Guerra / Premiações / Jogadores). Tabela de **personagens** ordenada por gear
  score desc: colunas Jogador · Personagem · Classe/Espec · Score `X/48`. Toque
  na linha abre o **detalhe por slot** (`slotBreakdown`). Ranking é por
  personagem (a composição da guerra é por personagem; quem tem 2 chars aparece
  2×). Protegido por `requireLeader` como o resto do painel.
- **Jogador** — o gear score de cada personagem seu aparece ao lado do botão SET
  no sheet "Meus personagens" (ex.: `Gear 32/48`). Só o próprio; não vê os outros.

## 7. API / integração

Segue os padrões atuais (`requireUser`/`requireLeader`, `toResponse`, envelope
simples via `Response.json`, cliente `lib/api-client.ts`).

- **`GET /api/characters`** — passa a incluir `equipment` e `score` em cada
  `CharacterDTO` (estende `listCharacters` + o tipo). Consumido pelo sheet do
  jogador.
- **`PUT /api/characters/[id]/equipment`** — nova rota. Body = objeto
  `Equipment`. Valida shape e faixas no servidor (refino 0–15, enums de add/tipo,
  no máx. 3 amuletos). Só o **dono** do personagem edita (`user_id` conferido no
  UPDATE, 404 caso contrário). Persiste o JSONB.
- **`GET /api/admin/gear`** — nova rota, `requireLeader`. Retorna todos os
  personagens com `{ userNome, personagem, classe, especializacao, score,
  breakdown }`, ordenados por score desc. Score/breakdown calculados no servidor
  via `lib/gear.ts`.
- **`lib/characters.ts`** — nova função `updateEquipment(userId, id, eq)` +
  validação; `listCharacters` passa a trazer `equipment`.
- **`lib/admin.ts`** — nova `gearRanking()` que lê characters + equipment e
  ordena por `gearScore`.

## 8. Validação & segurança

- Payload de `equipment` validado no servidor (helper `parseEquipment` em
  `lib/gear.ts` ou `lib/characters.ts`): faixas de refino, enums de add/tipo,
  tamanho do array de amuletos. Entrada inválida → 400. Nunca confia no cliente.
- Escrita de equipamento só pelo dono; leitura do ranking só pelo líder.
- Sem segredos, sem SQL dinâmico (queries parametrizadas como no resto do app).

## 9. Referência visual

A base é o **screenshot da janela de Equipamento do WYD** enviado pelo usuário.
Para a implementação bater o layout "bem próximo", o arquivo deve ser salvo no
repo como `guerra/docs/superpowers/specs/assets/equip-ref.png` (ação pendente:
adicionar o arquivo). A grade de slots (§5) reproduz o agrupamento do jogo:
montaria/elmo no topo, peças do set ao centro, arma/escudo/capa/runa à direita,
amuletos/anel/brinco/cinto nas laterais. As posições exatas dos 16 slots serão
ajustadas contra a imagem na implementação.

## 10. Testes

Vitest em `tests/gear.test.ts` (coerente com "vitest só no domínio"):
- pontuação por slot em cada faixa (refino `<13/13/14/15`, capa `+0/+9/+11`,
  runa `nãotem/+1–5/+6–9`, add `sux/semi/full`, tipo `T1/T2`, pet `120/150`);
- soma total: set vazio/`null` = 0; set máximo = 48;
- fronteiras: runa +5 vs +6, capa +9 vs +11, cythera (add+refino somados);
- `slotBreakdown` bate com `gearScore` (soma do breakdown = total);
- `parseEquipment` rejeita payloads inválidos (refino fora de faixa, add/tipo
  desconhecido, >3 amuletos).

## 11. Fora de escopo (YAGNI)

- Ícones fiéis item-a-item do WYD (usaremos ícones/estilização aproximados; o
  layout e o clima é que importam).
- Histórico/evolução do gear score ao longo do tempo.
- Integração do gear score com os pontos/premiações semanais (decisão: ranking
  de força é separado).
- Edição do equipamento pelo líder (só o dono edita; o líder só visualiza).
