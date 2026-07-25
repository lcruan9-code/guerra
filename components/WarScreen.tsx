'use client';

import { useState } from 'react';
import Image from 'next/image';
import { api } from '@/lib/api-client';
import { BRAND } from '@/lib/brand';
import type { CurrentData } from './GuerraApp';
import CharacterForm from './CharacterForm';
import RankingSheet from './RankingSheet';
import LeaderUnlockCard from './LeaderUnlockCard';
import WarBlock from './WarBlock';
import EquipmentGrid from './EquipmentGrid';
import { GEAR_MAX } from '@/lib/gear';
import type { CharacterDTO } from '@/lib/types';

export default function WarScreen({ data, reload }: { data: CurrentData; reload: () => Promise<void> }) {
  const { user, characters, leaderUnlocked, wars } = data;
  const [managing, setManaging] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [equipChar, setEquipChar] = useState<CharacterDTO | null>(null);

  return (
    <div className="app-wrap">
      <header className="app-header">
        <div className="brand">
          <Image className="brand-logo" src="/guild-logo.png" alt={BRAND.guildName} width={46} height={46} />
          <div>
            <div className="brand-name">{BRAND.guildName}</div>
            <div className="brand-sub">
              GUERRA · <span className="reino">REINO {BRAND.reino}</span>
            </div>
          </div>
        </div>
        <button className="user-chip" onClick={() => setMenuOpen(true)}>
          <div className="user-chip-info">
            <div className="user-name">{user.nome}</div>
            <div className="user-points">{user.pontos} pontos</div>
          </div>
          <span className="user-chip-caret">▾</span>
        </button>
      </header>

      <div className="nav-row">
        <button className="btn-ghost accent" onClick={() => setRanking(true)}>
          🏆 Premiações
        </button>
        {leaderUnlocked ? (
          <a className="btn-ghost" href="/admin">
            ⚙️ Painel
          </a>
        ) : (
          <button className="btn-ghost" onClick={() => setUnlocking(true)}>
            🔒 Líder
          </button>
        )}
        <button className="btn-ghost" onClick={() => setManaging(true)}>
          Personagens
        </button>
      </div>

      {wars.length > 1 && (
        <p className="day-note">Hoje tem {wars.length} guerras — confirme cada uma.</p>
      )}

      {wars.map((war) => (
        <WarBlock
          key={war.id}
          war={war}
          characters={characters}
          leaderUnlocked={leaderUnlocked}
          reloadCurrent={reload}
        />
      ))}

      {menuOpen && (
        <div className="sheet-overlay" onClick={() => setMenuOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="menu-head">
              <div className="menu-name">{user.nome}</div>
              <div className="menu-points">
                {user.pontos} pontos{user.role === 'ADMIN' ? ' · líder' : ''}
              </div>
            </div>
            <button className="menu-item" onClick={() => { setMenuOpen(false); setManaging(true); }}>
              🧙 Meus personagens
            </button>
            <button className="menu-item" onClick={() => { setMenuOpen(false); setRanking(true); }}>
              🏆 Premiações & ranking
            </button>
            <button
              className="menu-item danger"
              onClick={() => {
                if (confirm('Sair apaga a sessão deste aparelho. Sem login, você recomeça o cadastro do zero. Continuar?')) {
                  void api('/api/auth/logout', { method: 'POST' }).then(() => window.location.reload());
                }
              }}
            >
              🚪 Sair da conta
            </button>
            <button className="btn-ghost full" style={{ marginTop: 8 }} onClick={() => setMenuOpen(false)}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {ranking && <RankingSheet onClose={() => setRanking(false)} />}

      {unlocking && (
        <div className="sheet-overlay" onClick={() => setUnlocking(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <LeaderUnlockCard
              onDone={async () => {
                setUnlocking(false);
                await reload();
              }}
            />
          </div>
        </div>
      )}

      {managing && (
        <div className="sheet-overlay" onClick={() => setManaging(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2 className="sheet-title">Meus personagens</h2>
            {characters.map((c) => (
              <div key={c.id} className="manage-block">
                <CharacterForm initial={c} onSaved={() => { setManaging(false); void reload(); }} />
                <div className="equip-row">
                  <span className="equip-row-score">⚔️ Gear {c.score ?? 0}/{GEAR_MAX}</span>
                  <button className="btn-set" onClick={() => setEquipChar(c)}>⚔️ Montar SET</button>
                </div>
              </div>
            ))}
            {characters.length < 2 && (
              <div className="manage-block">
                <div className="label">Adicionar 2º personagem</div>
                <CharacterForm onSaved={() => { setManaging(false); void reload(); }} />
              </div>
            )}
            <button onClick={() => setManaging(false)} className="btn-ghost full" style={{ marginTop: 4 }}>
              Fechar
            </button>

            {equipChar && (
              <EquipmentGrid
                character={equipChar}
                onClose={() => setEquipChar(null)}
                onSaved={() => { setEquipChar(null); void reload(); }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
