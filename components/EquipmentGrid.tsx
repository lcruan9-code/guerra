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
  area: string; // grid-area (layout espelhando a janela de Equipamento do WYD)
}

// Layout aproximando a janela do jogo: montaria/elmo/runa/capa no topo,
// arma/peito/escudo ao centro, acessórios/amuletos nas laterais e base.
const SLOTS: SlotDef[] = [
  { key: 'pet', label: 'Pet', kind: 'pet', area: 'pet' },
  { key: 'cythera', label: 'Cythera', kind: 'refinoAdd', area: 'cythera' },
  { key: 'runa', label: 'Runa', kind: 'runa', area: 'runa' },
  { key: 'capa', label: 'Capa', kind: 'capa', area: 'capa' },
  { key: 'arma', label: 'Arma', kind: 'refino', area: 'arma' },
  { key: 'armadura', label: 'Peito', kind: 'refino', area: 'peito' },
  { key: 'escudo', label: 'Escudo', kind: 'refino', area: 'escudo' },
  { key: 'anel', label: 'Colar', kind: 'tipo', area: 'anel' },
  { key: 'brinco', label: 'Brinco', kind: 'tipo', area: 'brinco' },
  { key: 'luvas', label: 'Luva', kind: 'refino', area: 'luvas' },
  { key: 'calca', label: 'Calça', kind: 'refino', area: 'calca' },
  { key: 'amuleto1', label: 'Amuleto', kind: 'add', area: 'amu1' },
  { key: 'amuleto2', label: 'Amuleto', kind: 'add', area: 'amu2' },
  { key: 'cinto', label: 'Cinto', kind: 'tipo', area: 'cinto' },
  { key: 'botas', label: 'Bota', kind: 'refino', area: 'botas' },
  { key: 'amuleto3', label: 'Amuleto', kind: 'add', area: 'amu3' },
];

// Ícones recortados da janela real do WYD (public/equip/<key>.png). Escudo veio
// vazio no print → sem imagem (tile placeholder).
const NO_ICON = new Set(['escudo']);
function iconSrc(key: string): string | null {
  return NO_ICON.has(key) ? null : `/equip/${key}.png`;
}

// ── leitura/escrita imutável do valor de cada slot ────────────────
function amuIndex(key: string): number {
  return { amuleto1: 0, amuleto2: 1, amuleto3: 2 }[key] ?? -1;
}
function setAmu(eq: Equipment, i: number, v: AddTier | null): Equipment {
  const arr: (AddTier | null)[] = [eq.amuletos?.[0] ?? null, eq.amuletos?.[1] ?? null, eq.amuletos?.[2] ?? null];
  arr[i] = v;
  return { ...eq, amuletos: arr };
}

// Valor escolhido pelo jogador (refino/tipo/lvl). '' = slot não preenchido.
function slotValue(eq: Equipment, s: SlotDef): string {
  const ref = (r?: number | null) => (r ? `+${r}` : '');
  switch (s.kind) {
    case 'pet': return eq.pet ? `lvl ${eq.pet}` : '';
    case 'refinoAdd': return ref(eq.cythera?.refino);
    case 'capa': return eq.capa?.refino ? `+${eq.capa.refino}` : (eq.capa?.add ? '+0' : '');
    case 'runa': return eq.runa?.refino ? `+${eq.runa.refino}` : '';
    case 'add': { const v = eq.amuletos?.[amuIndex(s.key)]; return v ? '+9' : ''; }
    case 'tipo': { const v = eq[s.key as 'anel' | 'brinco' | 'cinto']; return v ?? ''; }
    default: { const v = eq[s.key as 'arma' | 'escudo' | 'armadura' | 'calca' | 'luvas' | 'botas']; return ref(v?.refino); }
  }
}
function slotAdd(eq: Equipment, s: SlotDef): string {
  const a = (t?: AddTier | null) => (t ? t.toLowerCase() : '');
  switch (s.kind) {
    case 'refinoAdd': return a(eq.cythera?.add);
    case 'capa': return a(eq.capa?.add);
    case 'add': return a(eq.amuletos?.[amuIndex(s.key)]);
    default: return '';
  }
}

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
        <div className="equip-frame">
          <div className="equip-titlebar">Equipamento</div>
          <div className="equip-head">
            <div className="equip-who">Personagem: <b>{character.nome}</b></div>
            <div className="equip-score">{score}<span>/{GEAR_MAX}</span></div>
          </div>

          <div className="equip-grid">
            {SLOTS.map((s) => {
              const val = slotValue(eq, s);
              const add = slotAdd(eq, s);
              const pts = bySlot.get(s.key) ?? 0;
              const src = iconSrc(s.key);
              const set = val !== '';
              return (
                <div key={s.key} className="equip-cell" style={{ gridArea: s.area }}>
                  <button
                    className={`equip-slot${set ? '' : ' unset'}`}
                    onClick={() => setEditing(s)}
                    aria-label={`${s.label}${val ? ` ${val}` : ' (não preenchido)'}`}
                  >
                    {src
                      ? <img className="equip-img" src={src} alt="" draggable={false} />
                      : <span className="equip-img-empty">escudo</span>}
                    <span className={`equip-pts${pts ? '' : ' zero'}`}>{pts}</span>
                  </button>
                  <span className="equip-name">{s.label}</span>
                  <span className="equip-setval">{set ? `${val}${add ? ` ${add}` : ''}` : '—'}</span>
                </div>
              );
            })}
          </div>
        </div>

        {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
        <div className="form-actions" style={{ marginTop: 14 }}>
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
