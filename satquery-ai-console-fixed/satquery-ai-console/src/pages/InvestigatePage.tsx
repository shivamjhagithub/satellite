import React, { useState } from 'react';
import { HealthStrip } from '../components/HealthStrip';
import { OpGrid } from '../components/OpGrid';
import { RunPanel } from '../components/RunPanel';
import { OpId } from '../data/operations';

export const InvestigatePage: React.FC<{ onRun: () => void }> = ({ onRun }) => {
  const [opId, setOpId] = useState<OpId | null>(null);

  return (
    <section>
      <div className="page-head">
        <div className="eyebrow">See · Understand · Know</div>
        <h1 className="page-title">Ask the Earth.</h1>
        <p className="page-desc">
          Every action below calls a real endpoint on your Spring Boot backend and the Python AI service behind it — nothing here is
          mocked. Pick an operation, choose the asset(s) from the sidebar, and start the investigation.
        </p>
      </div>

      <HealthStrip />
      <OpGrid selected={opId} onSelect={setOpId} />
      <RunPanel opId={opId} onDone={onRun} />
    </section>
  );
};
