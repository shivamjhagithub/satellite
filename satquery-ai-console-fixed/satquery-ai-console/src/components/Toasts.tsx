import React from 'react';
import { useApp } from '../state/AppContext';

export const Toasts: React.FC = () => {
  const { toasts } = useApp();
  return (
    <div id="toast-container">
      {toasts.map((t) => (
        <div className={`toast ${t.kind}`} key={t.id}>
          {t.message}
        </div>
      ))}
    </div>
  );
};
