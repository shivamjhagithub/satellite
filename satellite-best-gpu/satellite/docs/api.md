# API

## Spring Boot (`http://localhost:8080`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Aggregated health: Postgres + Python AI service |
| GET | `/actuator/health` | Spring Actuator liveness/readiness |
| POST | `/api/projects` | Create a project (name + description) |
| GET | `/api/projects` | List projects |
| GET | `/api/projects/{id}` | Get one project |
| GET | `/api/projects/{id}/assets` | List raster metadata for a project |
| POST | `/api/projects/{id}/assets` | Multipart GeoTIFF upload (`file`, optional `modality`) |
| GET | `/api/assets/{id}` | Get one raster asset |
| POST | `/api/assets/{id}/metadata/refresh` | Re-read GeoTIFF metadata from MinIO |
| POST | `/api/assets/{id}/compatibility/{otherId}` | CRS/overlap/resolution comparison |
| POST | `/api/assets/{id}/processing-plan/{otherId}` | What to reproject/resample/align |
| POST | `/api/assets/{id}/align/{referenceId}` | Warp source onto the reference grid |
| POST | `/api/assets/{id}/tiles` | Build VLM preview tiles |
| POST | `/api/projects/{id}/pairs` | Link two assets (change / optical-SAR / reference) |
| GET | `/api/pairs/{id}` | Get an image pair |
| POST | `/api/ai/caption` | Caption one asset |
| POST | `/api/ai/vqa` | Visual question answering |
| POST | `/api/ai/ground` | Grounding (boxes only if the VLM returns them) |
| POST | `/api/ai/change` | Classical change map + optional VQA |
| POST | `/api/ai/fusion` | Optical/SAR visualization fusion |
| POST | `/api/ai/chat` | Route a natural-language question to the tools above |
| GET | `/api/analyses/{id}` | Persisted analysis |

Example:

```json
{
  "status": "DEGRADED",
  "service": "backend",
  "javaVersion": "21.0.x",
  "postgres": { "status": "UP" },
  "pythonAiService": {
    "status": "DOWN",
    "modelLoaded": false
  }
}
```

`status` is `UP` only when Postgres **and** the Python service both respond `UP`. HTTP remains 200 so operators can still read the JSON when Python is down.

Every response includes header `X-Correlation-Id`.

## Python FastAPI (`http://localhost:8000`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Process health, library probes, VLM status |

Example:

```json
{
  "status": "UP",
  "service": "ai-service",
  "pythonVersion": "3.12.x",
  "rasterioAvailable": false,
  "gdalAvailable": false,
  "gdalVersion": null,
  "gpuAvailable": false,
  "modelLoaded": false,
  "model": "Qwen/Qwen3-VL-4B-Instruct",
  "vlmDevice": "auto"
}
```

Rasterio/GDAL are probed by import. Phase 1 images do **not** install them, so those flags are false until the geospatial image is added.

The raster, VQA, caption, grounding, change and fusion routes are registered. Grounding and change responses also return object-storage keys for rendered PNG artifacts.
