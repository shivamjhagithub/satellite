/**
 * Types mirror `satellite-frontend-api-contract.md` field-for-field.
 * Where the backend returns "whatever Python returns", fields are
 * optional/loose rather than invented.
 */

export type Modality = 'OPTICAL' | 'SAR' | 'UNKNOWN';
export type RelationshipType = 'TEMPORAL_CHANGE' | 'OPTICAL_SAR' | 'REFERENCE_TARGET' | 'OTHER';
export type AnalysisType = 'CAPTION' | 'VQA' | 'GROUNDING' | 'CHANGE' | 'FUSION' | 'CHAT';

export interface ApiErrorBody {
  errorCode: string;
  message: string;
  correlationId: string;
}

export class ApiError extends Error {
  errorCode?: string;
  correlationId?: string;
  status?: number;
  constructor(message: string, opts?: { errorCode?: string; correlationId?: string; status?: number }) {
    super(message);
    this.errorCode = opts?.errorCode;
    this.correlationId = opts?.correlationId;
    this.status = opts?.status;
  }
}

export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RasterAssetResponse {
  id: string;
  projectId: string;
  objectKey: string;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  modality: Modality;
  sensor: string | null;
  platform: string | null;
  acquisitionTime: string | null;
  processingLevel: string | null;
  crs: string | null;
  epsg: number | null;
  width: number | null;
  height: number | null;
  bandCount: number | null;
  resolutionX: number | null;
  resolutionY: number | null;
  boundsMinX: number | null;
  boundsMinY: number | null;
  boundsMaxX: number | null;
  boundsMaxY: number | null;
  nodata: number | null;
  transform: string | null;
  metadataJson: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetPreviewResponse {
  objectKey: string;
  contentType: string;
}

export interface ImagePairResponse {
  id: string;
  assetAId: string;
  assetBId: string;
  relationshipType: RelationshipType;
  createdAt: string;
}

export interface WgsBoundingBox {
  minLatitude: number;
  minLongitude: number;
  maxLatitude: number;
  maxLongitude: number;
}
export interface GeoJsonPolygon {
  type: string;
  coordinates: number[][][];
}
export interface Wgs84Info {
  crs: string;
  epsg: number;
  latitude: number;
  longitude: number;
  boundingBox: WgsBoundingBox;
  footprint: GeoJsonPolygon;
}
/** Same shape as Wgs84Info — used inside AI result payloads. */
export type GeoReference = Wgs84Info;

export interface AssetGeoMetadata {
  crs: string;
  epsg: number;
  missingCrs: boolean;
  wgs84: Wgs84Info;
  width: number;
  height: number;
  bandCount: number;
  resolutionX: number;
  resolutionY: number;
  boundsMinX: number;
  boundsMinY: number;
  boundsMaxX: number;
  boundsMaxY: number;
  nodata: number | null;
  transform: string;
  driver: string;
  dtype: string;
  bandDescriptions: string[];
  tags: Record<string, string>;
}

export interface CompatibilityResponse {
  assetA: AssetGeoMetadata;
  assetB: AssetGeoMetadata;
  compatible: boolean;
  overlap: boolean;
  sameCrs: boolean;
  sameResolution: boolean;
  sameGrid: boolean;
  requiresReprojection: boolean;
  requiresResampling: boolean;
  requiresAlignment: boolean;
  requiresOverlapCrop: boolean;
  reasons: string[];
  targetCrs: string;
  targetResolution: number;
  targetWidth: number;
  targetHeight: number;
  targetTransform: string;
}
/** Current backend implementation returns the same shape as compatibility. */
export type ProcessingPlanResponse = CompatibilityResponse;

export interface AlignResponse {
  objectKey: string;
  crs: string;
  epsg: number;
  missingCrs: boolean;
  wgs84: Wgs84Info;
  width: number;
  height: number;
  bandCount: number;
  dtype: string;
  transform: string;
  resolutionX: number;
  resolutionY: number;
  boundsMinX: number;
  boundsMinY: number;
  boundsMaxX: number;
  boundsMaxY: number;
  nodata: number | null;
  driver: string;
  bandDescriptions: string[];
  tags: Record<string, string>;
}

export interface TileInfo {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  boundsMinX: number;
  boundsMinY: number;
  boundsMaxX: number;
  boundsMaxY: number;
  crs: string;
  objectKey: string;
}
export interface TilesResponse {
  tiles: TileInfo[];
}

export interface LatLon {
  latitude: number;
  longitude: number;
}
export interface PixelBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface DetectionGeometry {
  type: string;
  coordinates: number[][][];
  crs?: string;
  centroid?: LatLon;
  areaSquareMeters?: number;
  areaHectares?: number;
}
export interface Detection {
  tileIndex?: number;
  label: string;
  pixel?: PixelBox;
  sourcePixel?: PixelBox;
  geometry?: DetectionGeometry;
  coordinateSource?: string;
  coordinatesAreModelGenerated?: boolean;
  location?: LatLon;
  areaSquareMeters?: number;
  areaHectares?: number;
}

export interface CaptionResult {
  caption: string;
  model: string;
  modelLoaded: boolean;
  tileCount: number;
  geoReferences: GeoReference[];
}
export interface VqaResult {
  answer: string;
  model: string;
  modelLoaded: boolean;
  tileCounts: Record<string, number>;
  geoReferences: GeoReference[];
}
export interface GroundingResult {
  answer: string;
  detections: Detection[];
  groundingOverlayObjectKey: string;
  model: string;
  modelLoaded: boolean;
  tileCount: number;
  geoReferences: GeoReference[];
}
export interface ChangeGeoJsonFeatureProps {
  change: boolean;
  type: string;
  areaSquareMeters: number;
  areaHectares: number;
  centroid: LatLon;
}
export interface ChangeGeoJsonFeature {
  type: 'Feature';
  geometry: { type: string; coordinates: number[][][] };
  properties: ChangeGeoJsonFeatureProps;
}
export interface ChangeGeoJson {
  type: 'FeatureCollection';
  features: ChangeGeoJsonFeature[];
  crs: string;
  featureCount: number;
  totalAreaSquareMeters: number;
  totalAreaHectares: number;
  centroid: LatLon;
}
export interface ChangeResult {
  changeMapObjectKey: string;
  changeVisualizationObjectKey: string;
  changeGeoJsonObjectKey: string;
  changeGeoJson: ChangeGeoJson;
  geoReferences: GeoReference[];
  coordinateSource: string;
  coordinatesAreModelGenerated: boolean;
  method: string;
  meanAbsDiff: number;
  threshold: number;
  changedFraction: number;
  width: number;
  height: number;
  validPixelCount: number;
  changedPixelCount: number;
  crs: string;
  pixelAreaSquareMeters: number;
  changedAreaSquareMeters: number;
  changedAreaHectares: number;
  changeFeatureCount: number;
  changeCentroid: LatLon;
  modelLoaded?: boolean;
  answer?: string;
}
export interface FusionResult {
  fusionObjectKey: string;
  method: string;
  note: string;
  geoReferences: GeoReference[];
  answer?: string;
  modelLoaded?: boolean;
}
/** Chat can route to any tool, so its result is a loose union of the above. */
export type ChatResult = Partial<GroundingResult & ChangeResult & VqaResult & CaptionResult & FusionResult> &
  Record<string, unknown>;

export type AnalysisResult = CaptionResult | VqaResult | GroundingResult | ChangeResult | FusionResult | ChatResult;

export interface AnalysisResponse<T extends AnalysisResult = AnalysisResult> {
  id: string | null;
  projectId: string;
  type: AnalysisType;
  question: string | null;
  answer: string | null;
  result: T;
  routedTool: string | null;
  createdAt: string;
}

/** GET /api/analyses/{id} does NOT deserialize the stored result — see contract §26. */
export interface PersistedAnalysisResponse {
  id: string;
  projectId: string;
  type: AnalysisType;
  question: string | null;
  answer: string | null;
  result: { raw: string };
  routedTool: string | null;
  createdAt: string;
}

export interface PythonServiceHealth {
  status: string;
  service: string;
  pythonVersion: string;
  rasterioAvailable: boolean;
  gdalAvailable: boolean;
  gdalVersion: string;
  gpuAvailable: boolean;
  modelLoaded: boolean;
  model: string;
  vlmDevice: string;
}
export interface HealthResponse {
  status: string;
  service: string;
  javaVersion: string;
  postgres: { status: string };
  pythonAiService: PythonServiceHealth | null;
}