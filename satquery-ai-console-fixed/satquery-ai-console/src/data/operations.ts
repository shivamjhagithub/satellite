export type OpId = 'caption' | 'vqa' | 'ground' | 'change' | 'fusion' | 'chat' | 'compat' | 'plan' | 'align' | 'tiles';
export type OpGroup = 'ai' | 'geo';
export type QuestionRequirement = 'required' | 'optional' | 'none';

export interface OperationDef {
  id: OpId;
  group: OpGroup;
  /** Short telemetry-style code shown on the op card, e.g. 'CAP', 'VQA'. */
  code: string;
  title: string;
  method: 'POST';
  endpoint: string;
  needsA: boolean;
  needsB: boolean;
  labelA?: string;
  labelB?: string;
  question: QuestionRequirement;
  desc: string;
  placeholder?: string;
  /**
   * Indicative pipeline steps shown as a live-looking log while a request is
   * in flight. The backend does not stream real progress events for these
   * endpoints, so this is a simulated sequence timed to look plausible —
   * not a literal trace of the server. The panel that renders this always
   * labels it "Simulated pipeline trace" so it's never mistaken for real logs.
   */
  steps: string[];
}

export const OPERATIONS: OperationDef[] = [
  {
    id: 'caption',
    group: 'ai',
    code: 'CAP',
    title: 'Caption',
    method: 'POST',
    endpoint: '/api/ai/caption',
    needsA: true,
    needsB: false,
    question: 'optional',
    desc: 'Free-text description of a single image.',
    placeholder: 'Leave blank for the default description prompt.',
    steps: [
      'Resolving asset object key…',
      'Reading GeoTIFF bands from storage…',
      'Slicing scene into VLM tiles…',
      'Loading caption model onto device…',
      'Running inference over tiles…',
      'Merging per-tile captions…',
      'Reprojecting tile footprints to WGS84…',
      'Formatting response payload…',
    ],
  },
  {
    id: 'vqa',
    group: 'ai',
    code: 'VQA',
    title: 'Visual Q&A',
    method: 'POST',
    endpoint: '/api/ai/vqa',
    needsA: true,
    needsB: false,
    question: 'required',
    desc: 'Ask a specific visual question about one image.',
    placeholder: 'e.g. How many buildings are visible in this scene?',
    steps: [
      'Resolving asset object key…',
      'Reading GeoTIFF bands from storage…',
      'Tiling scene for the VQA model…',
      'Encoding question tokens…',
      'Running visual question-answering inference…',
      'Aggregating per-tile answers…',
      'Reprojecting tile footprints to WGS84…',
      'Formatting response payload…',
    ],
  },
  {
    id: 'ground',
    group: 'ai',
    code: 'GRD',
    title: 'Object Grounding',
    method: 'POST',
    endpoint: '/api/ai/ground',
    needsA: true,
    needsB: false,
    question: 'required',
    desc: 'Locate objects and get their real WGS84 coordinates.',
    placeholder: 'e.g. Find newly constructed buildings within 500m of major roads.',
    steps: [
      'Resolving asset object key…',
      'Reading GeoTIFF bands from storage…',
      'Tiling scene for the grounding model…',
      'Running open-vocabulary detection…',
      'Filtering low-confidence boxes…',
      'Converting pixel boxes to geometries…',
      'Reprojecting detections to WGS84…',
      'Rendering grounding overlay…',
      'Formatting response payload…',
    ],
  },
  {
    id: 'change',
    group: 'ai',
    code: 'CHG',
    title: 'Change Detection',
    method: 'POST',
    endpoint: '/api/ai/change',
    needsA: true,
    needsB: true,
    labelA: 'Before',
    labelB: 'After',
    question: 'optional',
    desc: 'Compare two aligned rasters, get a change GeoJSON.',
    placeholder: 'e.g. What changed between these two images?',
    steps: [
      'Resolving before/after object keys…',
      'Reading both GeoTIFFs from storage…',
      'Checking CRS and grid alignment…',
      'Computing pixel-wise absolute difference…',
      'Thresholding change mask…',
      'Vectorizing changed regions…',
      'Computing change area statistics…',
      'Reprojecting change GeoJSON to WGS84…',
      'Rendering change visualization…',
      'Formatting response payload…',
    ],
  },
  {
    id: 'fusion',
    group: 'ai',
    code: 'FUS',
    title: 'Optical + SAR Fusion',
    method: 'POST',
    endpoint: '/api/ai/fusion',
    needsA: true,
    needsB: true,
    labelA: 'Optical',
    labelB: 'SAR',
    question: 'optional',
    desc: 'Channel-stack visualization of optical and SAR.',
    placeholder: 'e.g. Describe the features visible in the fused image.',
    steps: [
      'Resolving optical/SAR object keys…',
      'Reading both rasters from storage…',
      'Normalizing SAR backscatter…',
      'Channel-stacking optical + SAR bands…',
      'Tiling fused scene for the VLM…',
      'Running inference over fused tiles…',
      'Reprojecting tile footprints to WGS84…',
      'Formatting response payload…',
    ],
  },
  {
    id: 'chat',
    group: 'ai',
    code: 'CHT',
    title: 'Orchestrated Chat',
    method: 'POST',
    endpoint: '/api/ai/chat',
    needsA: false,
    needsB: false,
    question: 'required',
    desc: 'Spring AI agent routes to the right tool for you.',
    placeholder: 'e.g. Show urban expansion between the two most recent scenes.',
    steps: [
      'Parsing message intent…',
      'Selecting candidate assets from project…',
      'Routing to the appropriate tool…',
      'Executing tool call…',
      'Collecting tool result…',
      'Composing natural-language answer…',
      'Formatting response payload…',
    ],
  },
  {
    id: 'compat',
    group: 'geo',
    code: 'CMP',
    title: 'Compatibility Check',
    method: 'POST',
    endpoint: '/api/assets/{id}/compatibility/{otherId}',
    needsA: true,
    needsB: true,
    question: 'none',
    desc: 'CRS, resolution and overlap comparison between two assets.',
    steps: [
      'Reading metadata for both assets…',
      'Comparing CRS and EPSG codes…',
      'Comparing pixel resolution…',
      'Checking spatial overlap…',
      'Deriving target grid parameters…',
      'Formatting response payload…',
    ],
  },
  {
    id: 'plan',
    group: 'geo',
    code: 'PLN',
    title: 'Processing Plan',
    method: 'POST',
    endpoint: '/api/assets/{id}/processing-plan/{otherId}',
    needsA: true,
    needsB: true,
    question: 'none',
    desc: 'What reprojection/resampling would be required.',
    steps: [
      'Reading metadata for both assets…',
      'Evaluating CRS compatibility…',
      'Evaluating resolution/grid compatibility…',
      'Determining required reprojection…',
      'Determining required resampling…',
      'Formatting response payload…',
    ],
  },
  {
    id: 'align',
    group: 'geo',
    code: 'ALN',
    title: 'Align Rasters',
    method: 'POST',
    endpoint: '/api/assets/{id}/align/{referenceId}',
    needsA: true,
    needsB: true,
    labelA: 'Source',
    labelB: 'Reference',
    question: 'none',
    desc: 'Reproject/resample source onto reference grid.',
    steps: [
      'Reading source and reference metadata…',
      'Computing target transform…',
      'Reprojecting source raster…',
      'Resampling onto reference grid…',
      'Writing aligned GeoTIFF to storage…',
      'Formatting response payload…',
    ],
  },
  {
    id: 'tiles',
    group: 'geo',
    code: 'TIL',
    title: 'Generate Tiles',
    method: 'POST',
    endpoint: '/api/assets/{id}/tiles',
    needsA: true,
    needsB: false,
    question: 'none',
    desc: 'Slice a raster into 512px preview tiles.',
    steps: [
      'Reading raster from storage…',
      'Computing tile grid…',
      'Slicing raster into 512px tiles…',
      'Computing per-tile WGS84 bounds…',
      'Writing tiles to storage…',
      'Formatting response payload…',
    ],
  },
];

export function opById(id: OpId): OperationDef {
  const op = OPERATIONS.find((o) => o.id === id);
  if (!op) throw new Error(`Unknown operation ${id}`);
  return op;
}
