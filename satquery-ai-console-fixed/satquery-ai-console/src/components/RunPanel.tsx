import React, { useEffect, useRef, useState } from 'react';
import { useApp, errMsg } from '../state/AppContext';
import { OpId, opById } from '../data/operations';
import { HistoryEntry } from '../state/AppContext';

/**
 * Timed playback of `op.steps` while a request is in flight.
 *
 * The backend does not stream real progress events for these endpoints —
 * a request is a single request/response round trip. This plays the
 * operation's step list at a plausible pace so the panel doesn't just sit
 * on a bare spinner, and loops a "still working" line if the real response
 * takes longer than the scripted sequence. It is always labeled as a
 * simulated trace in the UI so it's never mistaken for a genuine log.
 */
function useSimulatedLog(steps: string[], running: boolean) {
  const [lines, setLines] = useState<{ text: string; done: boolean }[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!running) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    setLines([]);
    let i = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (i < steps.length) {
        const text = steps[i];
        i += 1;
        setLines((prev) => [...prev, { text, done: false }]);
        const delay = 550 + Math.random() * 500;
        timerRef.current = setTimeout(tick, delay);
      } else {
        // Scripted steps exhausted but the response hasn't returned yet —
        // hold on a generic "still working" line rather than stopping.
        setLines((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.text === 'Waiting on backend…') return prev;
          return [...prev, { text: 'Waiting on backend…', done: false }];
        });
        timerRef.current = setTimeout(tick, 1400);
      }
    };

    timerRef.current = setTimeout(tick, 260);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return [lines, setLines] as const;
}

export const RunPanel: React.FC<{ opId: OpId | null; onDone: () => void }> = ({ opId, onDone }) => {
  const { assetA, assetB, assetById, client, projectId, toast, pushResult } = useApp();
  const [question, setQuestion] = useState('');
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const op = opId ? opById(opId) : null;
  const [logLines, setLogLines] = useSimulatedLog(op?.steps ?? [], running);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [logLines]);

  if (!op) return null;
  const a = assetById(assetA);
  const b = assetById(assetB);
  const labelA = op.labelA ?? 'Asset A';
  const labelB = op.labelB ?? 'Asset B';

  const finishLog = (ok: boolean) => {
    setLogLines((prev) => {
      const trimmed = prev.filter((l) => l.text !== 'Waiting on backend…');
      return [...trimmed, { text: ok ? 'Done.' : 'Failed.', done: true }];
    });
  };

  const run = async () => {
    if (op.question === 'required' && !question.trim()) {
      toast('This operation needs a question.', 'err');
      return;
    }
    if (op.needsA && !assetA) {
      toast('Select Asset A from the sidebar.', 'err');
      return;
    }
    if (op.needsB && !assetB) {
      toast('Select Asset B from the sidebar.', 'err');
      return;
    }
    if (op.id === 'chat' && !projectId) {
      toast('Select a project first.', 'err');
      return;
    }

    setRunning(true);
    setStatus(null);
    try {
      let type: HistoryEntry['type'] = op.id.toUpperCase() as HistoryEntry['type'];
      let result: unknown;
      let answer: string | null = null;

      switch (op.id) {
        case 'caption': {
          const r = await client.caption(assetA!, question || undefined);
          result = r.result;
          answer = r.answer;
          type = 'CAPTION';
          break;
        }
        case 'vqa': {
          const r = await client.vqa(assetA!, question);
          result = r.result;
          answer = r.answer;
          type = 'VQA';
          break;
        }
        case 'ground': {
          const r = await client.ground(assetA!, question);
          result = r.result;
          answer = r.answer;
          type = 'GROUNDING';
          break;
        }
        case 'change': {
          const r = await client.change(assetA!, assetB!, question || undefined);
          result = r.result;
          answer = r.answer;
          type = 'CHANGE';
          break;
        }
        case 'fusion': {
          const r = await client.fusion(assetA!, assetB!, question || undefined);
          result = r.result;
          answer = r.answer;
          type = 'FUSION';
          break;
        }
        case 'chat': {
          const r = await client.chat(projectId, question, [assetA, assetB].filter(Boolean) as string[]);
          result = r.result;
          answer = r.answer;
          type = 'CHAT';
          break;
        }
        case 'compat':
          result = await client.compatibility(assetA!, assetB!);
          type = 'COMPATIBILITY';
          break;
        case 'plan':
          result = await client.processingPlan(assetA!, assetB!);
          type = 'PROCESSING_PLAN';
          break;
        case 'align':
          result = await client.align(assetA!, assetB!);
          type = 'ALIGN';
          break;
        case 'tiles':
          result = await client.tiles(assetA!);
          type = 'TILES';
          break;
      }

      setStatus({ ok: true, msg: 'Done.' });
      finishLog(true);
      toast(op.title + ' completed.', 'ok');
      pushResult({
        type,
        question,
        answer,
        result,
        assetAName: a?.originalFilename ?? null,
        assetBName: b?.originalFilename ?? null,
        assetAId: a?.id ?? null,
        assetBId: b?.id ?? null,
      });
      onDone();
    } catch (err) {
      setStatus({ ok: false, msg: errMsg(err) });
      finishLog(false);
      toast(errMsg(err), 'err');
    }
    setRunning(false);
  };

  return (
    <div className="run-panel panel">
      <div className="endpoint-tag">
        {op.method} {op.endpoint}
      </div>
      {op.id === 'chat' && !projectId && (
        <div className="hint" style={{ color: 'var(--red)', marginBottom: 10 }}>
          Select a project first — chat requires a projectId.
        </div>
      )}
      {(op.needsA || op.needsB) && (
        <div className="slot-grid">
          {op.needsA && (
            <div className="slot">
              <div className="slot-label">{labelA}</div>
              <div className={`slot-val ${a ? '' : 'empty'}`}>{a ? a.originalFilename || a.objectKey : 'Select from sidebar →'}</div>
            </div>
          )}
          {op.needsB && (
            <div className="slot">
              <div className="slot-label">{labelB}</div>
              <div className={`slot-val ${b ? '' : 'empty'}`}>{b ? b.originalFilename || b.objectKey : 'Select from sidebar →'}</div>
            </div>
          )}
        </div>
      )}
      {op.question !== 'none' && (
        <div className="field">
          <label>
            Question {op.question === 'required' ? <span style={{ color: 'var(--red)' }}>*</span> : '(optional — a sensible default is used otherwise)'}
          </label>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={op.placeholder} />
        </div>
      )}
      <button className="btn primary" onClick={run} disabled={running}>
        {running ? <span className="spinner" /> : '▶'} Start investigation
      </button>
      {status && !running && (
        <div className="hint" style={{ marginTop: 10, color: status.ok ? '#8fe6b3' : '#fca5a5' }}>
          {status.msg}
        </div>
      )}
      {logLines.length > 0 && (
        <div className="log-panel">
          <div className="log-panel-head">
            <span className={`log-dot ${running ? 'live' : status?.ok ? 'ok' : 'err'}`} />
            Simulated pipeline trace
            <span className="log-panel-note">— indicative steps, not raw backend output</span>
          </div>
          <div className="log-box" ref={logBoxRef}>
            {logLines.map((l, i) => (
              <div key={i} className={`log-line ${l.done ? (status?.ok === false ? 'log-err' : 'log-ok') : ''}`}>
                <span className="log-prefix">{l.done ? (status?.ok === false ? '✕' : '✓') : '›'}</span>
                {l.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};