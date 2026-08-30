import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SatQueryClient } from '../api/client';
import { ApiError, HealthResponse, Modality, ProjectResponse, RasterAssetResponse } from '../types/api';
import { extractLocations, PlottedLocation } from '../utils/location';

export interface HistoryEntry {
  ts: number;
  type: PlottedLocation['source'] | 'TILES';
  question?: string | null;
  answer?: string | null;
  result: unknown;
  assetAName?: string | null;
  assetBName?: string | null;
  assetAId?: string | null;
  assetBId?: string | null;
}

export interface Toast {
  id: number;
  message: string;
  kind: 'ok' | 'err' | 'info';
}

interface AppState {
  apiBase: string;
  setApiBase: (v: string) => void;
  client: SatQueryClient;

  health: HealthResponse | null;
  healthError: string | null;
  refreshHealth: () => Promise<void>;

  projects: ProjectResponse[];
  projectId: string;
  setProjectId: (id: string) => void;
  refreshProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<void>;

  assets: RasterAssetResponse[];
  refreshAssets: () => Promise<void>;
  uploadAsset: (file: File, modality: Modality) => Promise<void>;

  assetA: string | null;
  assetB: string | null;
  cycleAssetRole: (id: string) => void;
  assetById: (id: string | null) => RasterAssetResponse | undefined;

  history: HistoryEntry[];
  current: HistoryEntry | null;
  setCurrent: (e: HistoryEntry) => void;
  pushResult: (e: Omit<HistoryEntry, 'ts'>) => void;

  markers: PlottedLocation[];
  plotLocations: (locs: PlottedLocation[]) => void;
  clearMarkers: () => void;
  focusTarget: PlottedLocation | null;
  focusLocation: (loc: PlottedLocation) => void;

  toasts: Toast[];
  toast: (message: string, kind?: Toast['kind']) => void;
}

const AppContext = createContext<AppState | null>(null);

function errMsg(err: unknown): string {
  if (err instanceof ApiError) return err.errorCode ? `${err.errorCode}: ${err.message}` : err.message;
  if (err instanceof Error) return err.message;
  return 'Unexpected error.';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiBase, setApiBaseState] = useState(
    localStorage.getItem('sq_api_base') || (import.meta.env.VITE_API_BASE_URL as string) || ''
  );
  const client = useMemo(() => new SatQueryClient(apiBase), [apiBase]);
  const setApiBase = useCallback((v: string) => {
    const clean = v.trim().replace(/\/$/, '');
    localStorage.setItem('sq_api_base', clean);
    setApiBaseState(clean);
  }, []);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [projectId, setProjectIdState] = useState(localStorage.getItem('sq_project_id') || '');
  const [assets, setAssets] = useState<RasterAssetResponse[]>([]);
  const [assetA, setAssetA] = useState<string | null>(null);
  const [assetB, setAssetB] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [current, setCurrent] = useState<HistoryEntry | null>(null);
  const [markers, setMarkers] = useState<PlottedLocation[]>([]);
  const [focusTarget, setFocusTarget] = useState<PlottedLocation | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const toast = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const h = await client.health();
      setHealth(h);
      setHealthError(null);
    } catch (err) {
      setHealth(null);
      setHealthError(errMsg(err));
    }
  }, [client]);

  const refreshProjects = useCallback(async () => {
    try {
      const list = await client.listProjects();
      setProjects(list);
      if (projectId && list.some((p) => p.id === projectId)) {
        // keep selection
      } else if (list.length) {
        setProjectIdState(list[0].id);
        localStorage.setItem('sq_project_id', list[0].id);
      } else {
        setProjectIdState('');
      }
    } catch (err) {
      toast('Failed to load projects — ' + errMsg(err), 'err');
      setProjects([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const setProjectId = useCallback((id: string) => {
    setProjectIdState(id);
    localStorage.setItem('sq_project_id', id);
    setAssetA(null);
    setAssetB(null);
  }, []);

  const createProject = useCallback(
    async (name: string, description?: string) => {
      const p = await client.createProject(name, description || undefined);
      toast(`Project "${p.name}" created.`, 'ok');
      setProjectId(p.id);
      await refreshProjects();
    },
    [client, toast, setProjectId, refreshProjects]
  );

  const refreshAssets = useCallback(async () => {
    if (!projectId) {
      setAssets([]);
      return;
    }
    try {
      const list = await client.listAssets(projectId);
      setAssets(list);
    } catch (err) {
      toast('Failed to load assets — ' + errMsg(err), 'err');
      setAssets([]);
    }
  }, [client, projectId, toast]);

  const uploadAsset = useCallback(
    async (file: File, modality: Modality) => {
      if (!projectId) {
        toast('Select or create a project first.', 'err');
        return;
      }
      toast('Uploading ' + file.name + '…', 'info');
      try {
        await client.uploadAsset(projectId, file, modality);
        toast('Uploaded — metadata extracted.', 'ok');
        await refreshAssets();
      } catch (err) {
        toast('Upload failed — ' + errMsg(err), 'err');
      }
    },
    [client, projectId, toast, refreshAssets]
  );

  const cycleAssetRole = useCallback(
    (id: string) => {
      if (assetA === id) {
        setAssetA(null);
        setAssetB(id);
      } else if (assetB === id) {
        setAssetB(null);
      } else if (!assetA) {
        setAssetA(id);
      } else if (!assetB) {
        setAssetB(id);
      } else {
        setAssetA(id);
        setAssetB(null);
      }
    },
    [assetA, assetB]
  );

  const assetById = useCallback((id: string | null) => (id ? assets.find((a) => a.id === id) : undefined), [assets]);

  const plotLocations = useCallback((locs: PlottedLocation[]) => {
    setMarkers((prev) => {
      const next = [...prev];
      locs.forEach((l) => {
        const exists = next.some((m) => Math.abs(m.lat - l.lat) < 1e-6 && Math.abs(m.lon - l.lon) < 1e-6);
        if (!exists) next.push(l);
      });
      return next;
    });
    if (locs.length) setFocusTarget(locs[0]);
  }, []);
  const clearMarkers = useCallback(() => {
    setMarkers([]);
    setFocusTarget(null);
  }, []);
  const focusLocation = useCallback((loc: PlottedLocation) => setFocusTarget(loc), []);

  const pushResult = useCallback(
    (e: Omit<HistoryEntry, 'ts'>) => {
      const entry: HistoryEntry = { ...e, ts: Date.now() };
      setHistory((h) => [entry, ...h]);
      setCurrent(entry);
      const locs = extractLocations(entry.type as PlottedLocation['source'], entry.result, entry.assetAName, entry.assetBName);
      if (locs.length) plotLocations(locs);
    },
    [plotLocations]
  );

  useEffect(() => {
    refreshHealth();
    refreshProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  useEffect(() => {
    refreshAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, apiBase]);

  const value: AppState = {
    apiBase,
    setApiBase,
    client,
    health,
    healthError,
    refreshHealth,
    projects,
    projectId,
    setProjectId,
    refreshProjects,
    createProject,
    assets,
    refreshAssets,
    uploadAsset,
    assetA,
    assetB,
    cycleAssetRole,
    assetById,
    history,
    current,
    setCurrent,
    pushResult,
    markers,
    plotLocations,
    clearMarkers,
    focusTarget,
    focusLocation,
    toasts,
    toast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export { errMsg };