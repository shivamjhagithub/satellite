import React from 'react';
import { useApp } from '../state/AppContext';

export type Tab = 'investigate' | 'explorer' | 'results';

export const TopBar: React.FC<{ tab: Tab; onTab: (t: Tab) => void; onSettings: () => void }> = ({ tab, onTab, onSettings }) => {
  const { health, healthError } = useApp();
  const ok = !!health && (health.status === 'UP' || health.status === 'DEGRADED');
  const dotClass = healthError ? 'bad' : health?.status === 'UP' ? 'ok' : health ? 'warn' : 'bad';
  const label = healthError ? 'Backend unreachable' : health ? `Live · ${health.status}` : 'Connecting…';

  return (
    <>
      <div className="tricolor-strip" />
      <div className="topbar">
        <div className="brand">
          <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="9" fill="#0a1420" />
            <circle cx="20" cy="20" r="7.2" stroke="#ff7a21" strokeWidth="2" />
            <circle cx="20" cy="20" r="2" fill="#ffa55c" />
            <path d="M20 6 V11 M20 29 V34 M6 20 H11 M29 20 H34" stroke="#3f7fe0" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <div>
            <div className="brand-name">
              SatQuery <b>AI</b>
            </div>
            <div className="brand-sub">MISSION CONSOLE</div>
          </div>
        </div>

        <div className="isro-chip">
          <span className="flag-dot" />
          ISRO Earth Observation Programme
        </div>

        <div className="nav">
          <button className={tab === 'investigate' ? 'active' : ''} onClick={() => onTab('investigate')}>
            Investigate
          </button>
          <button className={tab === 'explorer' ? 'active' : ''} onClick={() => onTab('explorer')}>
            Data Explorer
          </button>
          <button className={tab === 'results' ? 'active' : ''} onClick={() => onTab('results')}>
            Results
          </button>
        </div>

        <div className="topbar-right">
          <div className="status-pill" onClick={onSettings} title="Click to view / change backend connection">
            <span className={`dot ${dotClass}`} />
            <span>{label}</span>
          </div>
          <button className="icon-btn" onClick={onSettings} title="Backend settings">
            ⚙
          </button>
        </div>
      </div>
    </>
  );
};
