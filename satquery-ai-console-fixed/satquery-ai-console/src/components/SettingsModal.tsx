import React, { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import { JsonView } from './JsonView';

export const SettingsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { apiBase, setApiBase, client, toast, refreshHealth } = useApp();
  const [value, setValue] = useState(apiBase);
  const [checking, setChecking] = useState(false);
  const [detail, setDetail] = useState<unknown>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(apiBase);
      setDetail(null);
      setDetailErr(null);
    }
  }, [open, apiBase]);

  if (!open) return null;

  const save = () => {
    if (value.trim()) {
      setApiBase(value);
      toast('API base updated.', 'ok');
    }
    onClose();
    setTimeout(refreshHealth, 50);
  };

  const runCheck = async () => {
    setChecking(true);
    setDetailErr(null);
    try {
      const h = await client.health();
      setDetail(h);
    } catch (err) {
      setDetail(null);
      setDetailErr(err instanceof Error ? err.message : 'Unexpected error.');
    }
    setChecking(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" style={{ float: 'right' }} onClick={onClose}>
          ✕
        </button>
        <h3>Backend connection</h3>
        <div className="modal-sub">Points at your Spring Boot service (default port 8080).</div>
        <div className="field">
          <label>API base URL</label>
          <input type="url" value={value} onChange={(e) => setValue(e.target.value)} placeholder="http://localhost:8080" />
        </div>
        <div className="hint">
          If this app is served from a different origin than the backend, the browser blocks requests unless the backend allows CORS.
          Add a <code>WebMvcConfigurer</code> bean with <code>addCorsMappings</code> allowing this origin (or <code>*</code> for local
          dev) on <code>/api/**</code> and <code>/health</code>.
        </div>
        <div className="small-btn-row" style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={save}>
            Save & reconnect
          </button>
          <button className="btn ghost" onClick={runCheck} disabled={checking}>
            {checking ? <span className="spinner" /> : null} Run health check
          </button>
        </div>
        {detail !== null && (
          <div style={{ marginTop: 14 }}>
            <JsonView data={detail} />
          </div>
        )}
        {detailErr && (
          <div className="hint" style={{ color: '#fca5a5', marginTop: 10 }}>
            {detailErr}
          </div>
        )}
      </div>
    </div>
  );
};
