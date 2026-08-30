import React from 'react';
import { useApp } from '../state/AppContext';

export const HealthStrip: React.FC = () => {
  const { health } = useApp();
  const py = health?.pythonAiService ?? null;

  const cards = [
    { label: 'Java service', val: health ? health.status : 'Offline', ok: !!health },
    { label: 'Postgres', val: health?.postgres?.status ?? '—', ok: !!health?.postgres && /up/i.test(health.postgres.status) },
    { label: 'Python AI service', val: py ? py.status : 'Offline', ok: !!py },
    { label: 'VLM model', val: py ? (py.modelLoaded ? py.model || 'Loaded' : 'Not loaded') : '—', ok: !!py?.modelLoaded },
  ];

  return (
    <div className="health-strip">
      {cards.map((c) => (
        <div className="health-card" key={c.label}>
          <div className="hc-top">
            <span className="hc-label">{c.label}</span>
            <span className={`dot ${c.ok ? 'ok' : 'bad'}`} />
          </div>
          <div className="hc-val">{String(c.val)}</div>
        </div>
      ))}
    </div>
  );
};
