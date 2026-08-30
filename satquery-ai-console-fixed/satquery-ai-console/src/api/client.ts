import {
  ApiError,
  AnalysisResponse,
  AssetPreviewResponse,
  CompatibilityResponse,
  ProcessingPlanResponse,
  AlignResponse,
  TilesResponse,
  ImagePairResponse,
  ProjectResponse,
  RasterAssetResponse,
  HealthResponse,
  PersistedAnalysisResponse,
  RelationshipType,
  Modality,
  ApiErrorBody,
} from '../types/api';

function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.append(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

export class SatQueryClient {
  constructor(private baseUrl: string) {}

  withBase(baseUrl: string) {
    return new SatQueryClient(baseUrl);
  }

  private async request<T>(
    method: string,
    path: string,
    opts?: { params?: Record<string, string | number | undefined | null>; body?: unknown; form?: FormData }
  ): Promise<T> {
    const url = this.baseUrl.replace(/\/$/, '') + path + qs(opts?.params ?? {});
    const init: RequestInit = { method, headers: {} };
    if (opts?.form) {
      init.body = opts.form;
    } else if (opts?.body !== undefined) {
      (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (e) {
      throw new ApiError(`Could not reach ${url}. Check the API base URL and CORS configuration.`);
    }

    const correlationId = res.headers.get('X-Correlation-Id') ?? undefined;
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      const body = (json ?? {}) as Partial<ApiErrorBody>;
      throw new ApiError(body.message ?? res.statusText, {
        errorCode: body.errorCode,
        correlationId: body.correlationId ?? correlationId,
        status: res.status,
      });
    }
    return json as T;
  }

  // ---- Health ------------------------------------------------------------
  health() {
    return this.request<HealthResponse>('GET', '/health');
  }

  // ---- Projects ------------------------------------------------------------
  listProjects() {
    return this.request<ProjectResponse[]>('GET', '/api/projects');
  }
  createProject(name: string, description?: string | null) {
    return this.request<ProjectResponse>('POST', '/api/projects', { body: { name, description: description ?? null } });
  }
  getProject(id: string) {
    return this.request<ProjectResponse>('GET', `/api/projects/${id}`);
  }

  // ---- Assets ------------------------------------------------------------
  listAssets(projectId: string) {
    return this.request<RasterAssetResponse[]>('GET', `/api/projects/${projectId}/assets`);
  }
  uploadAsset(projectId: string, file: File, modality: Modality) {
    const fd = new FormData();
    fd.append('file', file);
    return this.request<RasterAssetResponse>('POST', `/api/projects/${projectId}/assets`, {
      params: { modality },
      form: fd,
    });
  }
  getAsset(id: string) {
    return this.request<RasterAssetResponse>('GET', `/api/assets/${id}`);
  }
  refreshMetadata(id: string) {
    return this.request<RasterAssetResponse>('POST', `/api/assets/${id}/metadata/refresh`);
  }
  getAssetPreview(id: string) {
    return this.request<AssetPreviewResponse>('GET', `/api/assets/${id}/preview`);
  }

  /** Browser-usable URL for any stored object key (preview, change map, change visualization, etc). */
  objectUrl(objectKey: string) {
    return this.baseUrl.replace(/\/$/, '') + '/api/objects' + qs({ key: objectKey });
  }

  // ---- Pairs ------------------------------------------------------------
  createPair(projectId: string, assetAId: string, assetBId: string, relationshipType: RelationshipType) {
    return this.request<ImagePairResponse>('POST', `/api/projects/${projectId}/pairs`, {
      body: { assetAId, assetBId, relationshipType },
    });
  }
  getPair(id: string) {
    return this.request<ImagePairResponse>('GET', `/api/pairs/${id}`);
  }

  // ---- Geospatial ops ------------------------------------------------------------
  compatibility(assetId: string, otherAssetId: string) {
    return this.request<CompatibilityResponse>('POST', `/api/assets/${assetId}/compatibility/${otherAssetId}`);
  }
  processingPlan(assetId: string, otherAssetId: string) {
    return this.request<ProcessingPlanResponse>('POST', `/api/assets/${assetId}/processing-plan/${otherAssetId}`);
  }
  align(sourceAssetId: string, referenceAssetId: string) {
    return this.request<AlignResponse>('POST', `/api/assets/${sourceAssetId}/align/${referenceAssetId}`);
  }
  tiles(assetId: string) {
    return this.request<TilesResponse>('POST', `/api/assets/${assetId}/tiles`);
  }

  // ---- AI / VLM pipeline ------------------------------------------------------------
  caption(assetId: string, question?: string) {
    return this.request<AnalysisResponse>('POST', '/api/ai/caption', { params: { assetId, question } });
  }
  vqa(assetId: string, question: string) {
    return this.request<AnalysisResponse>('POST', '/api/ai/vqa', { params: { assetId, question } });
  }
  ground(assetId: string, question: string) {
    return this.request<AnalysisResponse>('POST', '/api/ai/ground', { params: { assetId, question } });
  }
  change(beforeAssetId: string, afterAssetId: string, question?: string) {
    return this.request<AnalysisResponse>('POST', '/api/ai/change', {
      params: { beforeAssetId, afterAssetId, question },
    });
  }
  fusion(opticalAssetId: string, sarAssetId: string, question?: string) {
    return this.request<AnalysisResponse>('POST', '/api/ai/fusion', {
      params: { opticalAssetId, sarAssetId, question },
    });
  }
  chat(projectId: string, message: string, assetIds?: string[]) {
    return this.request<AnalysisResponse>('POST', '/api/ai/chat', {
      body: { projectId, message, assetIds: assetIds ?? [] },
    });
  }

  // ---- Persisted analyses ------------------------------------------------------------
  getAnalysis(id: string) {
    return this.request<PersistedAnalysisResponse>('GET', `/api/analyses/${id}`);
  }
}