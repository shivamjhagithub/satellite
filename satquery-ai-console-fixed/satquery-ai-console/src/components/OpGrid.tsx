import React from 'react';
import { OPERATIONS, OpId } from '../data/operations';

export const OpGrid: React.FC<{ selected: OpId | null; onSelect: (id: OpId) => void }> = ({ selected, onSelect }) => {
  const ai = OPERATIONS.filter((o) => o.group === 'ai');
  const geo = OPERATIONS.filter((o) => o.group === 'geo');

  const card = (o: (typeof OPERATIONS)[number]) => (
    <div
      key={o.id}
      className={`op-card reticle ${selected === o.id ? 'active' : ''}`}
      onClick={() => onSelect(o.id)}
    >
      <span className="op-method">{o.method}</span>
      <span className="op-code">{o.code}</span>
      <div className="op-title">{o.title}</div>
      <div className="op-desc">{o.desc}</div>
    </div>
  );

  return (
    <>
      <div className="section-label">AI analysis (VLM pipeline)</div>
      <div className="op-grid">{ai.map(card)}</div>
      <div className="section-label">Geospatial operations</div>
      <div className="op-grid">{geo.map(card)}</div>
    </>
  );
};
