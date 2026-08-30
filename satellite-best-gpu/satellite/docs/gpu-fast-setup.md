# GPU laptop fast mode

## Recommended profile

Use the GPU Compose override:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

The override changes only runtime/build configuration; the Spring Boot API paths remain unchanged.

### Defaults

- Python VLM: `Qwen/Qwen3-VL-4B-Instruct`
- Quantization: 4-bit
- PyTorch: 2.8.0 + torchvision 0.23.0, CUDA 12.8 wheels
- VLM preview size: 768px
- Maximum tiles for large rasters: 4
- Maximum generated tokens: 96
- Deterministic generation: enabled
- Model preload: enabled at AI-service startup

### Why this is faster

1. The model is loaded once during startup instead of on the first request.
2. Demo-sized rasters up to 1400px use one whole-image VLM input rather than several sequential tile requests.
3. Larger rasters use at most four 768px tiles.
4. PyTorch inference uses `inference_mode`, SDPA attention and CUDA autocast.
5. Change maps are computed with NumPy/Rasterio first; the VLM is only used for semantic explanation when a question is supplied.

## Visual outputs

### Grounding

`POST /api/ai/ground` still has the same request and endpoint. The JSON now additionally contains:

- `groundingOverlayObjectKey`: PNG with red boxes/labels over the satellite image
- `detections[].geometry`: WGS84 polygon for each valid box
- `detections[].sourcePixel`: full-raster pixel coordinates

### Change detection

`POST /api/ai/change` still has the same request and endpoint. The JSON now additionally contains:

- `changeMapObjectKey`: black/white change map
- `changeVisualizationObjectKey`: before + after + change-map presentation PNG
- `changeGeoJsonObjectKey`: GeoJSON result
- `changeGeoJson`: inline GeoJSON FeatureCollection
- `changedAreaSquareMeters`
- `changedAreaHectares`
- `threshold`

The change detector uses normalized multi-band differences, adaptive thresholding and small-component cleanup. It is deliberately deterministic and fast; semantic labels such as "likely new construction" are produced by the VLM from the before/after images and change map.

## Hardware guidance

- **8 GB VRAM:** Qwen3-VL-4B + 4-bit; keep defaults.
- **12–16 GB VRAM:** Qwen3-VL-4B + 4-bit is the recommended fast mode; 8B can be tested if latency is acceptable.
- **16–24 GB+ VRAM:** Qwen3-VL-8B can be used for higher visual reasoning quality; keep 4-bit if memory is limited.

The exact latency depends on GPU model, image size and the number of generated tokens.

## Geospatial accuracy guarantees

The VLM is never trusted to generate latitude/longitude. It only returns visual observations and, for grounding, pixel bounding boxes.

- Image centers and footprints come from the source GeoTIFF CRS, affine transform and bounds.
- Grounding boxes are converted from pixel edges -> source CRS -> WGS84 (`EPSG:4326`).
- Grounding results include a WGS84 polygon, centroid and geodesic area.
- Change polygons are generated from the raster change mask and transformed to WGS84.
- Change area is calculated from the resulting WGS84 polygons with ellipsoidal/geodesic area, rather than blindly multiplying pixel counts by `transform.a * transform.e`.
- Responses explicitly identify the coordinate source and set `coordinatesAreModelGenerated=false`.
- Missing CRS is a hard error for geographic grounding/change output; the service does not invent a location.

## Visual result artifacts

`/ground` returns `groundingOverlayObjectKey`, a PNG with detected objects drawn over the satellite image, plus each detection's WGS84 geometry.

`/change` returns:

- `changeMapObjectKey`: binary change map
- `changeVisualizationObjectKey`: screenshot-style BEFORE / AFTER+DETECTED / CHANGE MAP visualization
- `changeGeoJsonObjectKey`: GeoJSON FeatureCollection
- `changeGeoJson`: inline GeoJSON with per-region area and centroid
- `changeCentroid`, `changedAreaSquareMeters`, `changedAreaHectares`

The semantic VLM answer is separated from the deterministic geospatial calculations. This means a phrase such as `New Construction (Likely)` is an AI interpretation, while the coordinates and measured area come from the raster georeferencing and change geometry.
