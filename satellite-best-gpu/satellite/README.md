# Satellite / Geospatial AI Platform

Hackathon-ready modular monolith: **Spring Boot 4.1.1 / Java 21** (APIs, Postgres, MinIO, Spring AI tool calling) + **one Python FastAPI service** (geospatial + Qwen3-VL) + **Ollama** for the Spring AI orchestration model.

The backend is containerized for the full ingest → preprocessing → VLM → geospatial → tool-calling workflow. Qwen3-VL handles image understanding in Python; Spring AI uses a local Qwen3 text model through Ollama to decide which application tool to execute.

## Why this architecture

| Choice | Reason |
|---|---|
| Modular monolith, not microservices | Faster to debug; one Python process still owns all raster/VLM work |
| Python FastAPI beside Java | Rasterio/GDAL and GPU inference are Python-native; Java keeps business data and orchestration |
| MinIO + Postgres | Files in object storage; metadata and jobs in the database |
| Qwen3-VL + Spring AI | Python handles image/raster inference; Spring AI handles tool orchestration |

## Layout

```
satellite-ai-platform/
  backend/              Spring Boot 4.1.1 (Java 21)
  ai-service/           FastAPI
  docs/
  test-data/
  docker-compose.yml
  .env.example
```

## Health contracts

**Python** `GET http://localhost:8000/health`

- **Receives:** nothing required; optional `X-Correlation-Id`
- **Returns:** `status`, `pythonVersion`, Rasterio/GDAL probes, `gpuAvailable`, configured `model`, `modelLoaded`
- **Consumed by:** Spring `PythonAiClient`, Docker healthchecks, operators

**Spring** `GET http://localhost:8080/health`

- **Receives:** nothing required; optional `X-Correlation-Id`
- **Does:** ping Postgres; call Python `/health` through `PythonAiClient`
- **Returns:** aggregated JSON (`UP` when both Postgres and Python are up, otherwise `DEGRADED`)
- **Consumed by:** operators and the backend container healthcheck

## Run with Docker Compose

Requires Docker Desktop. Copy env, then start:

```bash
copy .env.example .env
docker compose up --build
```

Then:

```bash
curl http://localhost:8000/health
curl http://localhost:8080/health
```

MinIO console: `http://localhost:9001` (credentials from `.env`).

## Run locally (without full Compose)

This environment may not have Maven, Python, or Docker on PATH. The backend includes **Maven Wrapper**.

1. Start Postgres and MinIO (`docker compose up postgres minio minio-init`).
2. Backend:

```bash
cd backend
.\mvnw.cmd spring-boot:run
```

3. AI service (Python 3.12+):

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### GPU mode, speed and visual results

The normal Compose profile remains CPU-safe. For an NVIDIA GPU laptop use:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

The GPU profile installs the CUDA 12.8 PyTorch wheels, exposes the NVIDIA GPU to the AI service and Ollama, and defaults the Python VLM to **Qwen3-VL-4B-Instruct in 4-bit mode**. Qwen's model card documents the 4B model and its stronger spatial/grounding capabilities. The code also preloads the VLM during AI-service startup so the first user request does not pay model-loading latency.

The VLM now receives the **whole raster preview** instead of only the top-left crop. Grounding is capped to four 768px tiles for a speed/accuracy balance, and the response includes a rendered PNG overlay with geographic detections. Change detection uses normalized multi-band differences, adaptive thresholding and small-component cleanup, then optionally asks the VLM to interpret the actual before/after images plus the change map. The change response includes both GeoJSON and a before/after/change visualization.

The existing API paths and request parameters are unchanged. Only additional result fields/object keys are produced for the visual artifacts.

For the pinned PyTorch 2.8 stack, CUDA 12.8 wheels exist for `torch==2.8.0` and `torchvision==0.23.0`, including CPython 3.12 Linux wheels.

### Tests

```bash
cd backend
.\mvnw.cmd test
```

```bash
cd ai-service
pytest
```

Python tests use FastAPI's TestClient. They do not download a VLM.

## Stack versions (Phase 1)

- Java 21 bytecode (this machine has JDK 25, which can compile it)
- Spring Boot **4.1.1** from start.spring.io so later Spring AI 2.x can sit on Boot 4
- PostgreSQL 16
- FastAPI 0.116 / Uvicorn 0.35 / Python 3.12 in Docker

## Current AI flow

`/api/ai/chat` uses Spring AI `ChatClient` and `@Tool` methods. The tools delegate to the existing `AnalysisService`; the LLM never directly manipulates raster bytes or bypasses project/asset validation. Ollama runs Qwen3 for local tool selection. Qwen3-VL remains the image model in Python.

## Hackathon MVP (what you actually need)

The original 32-step list is a teaching breakdown. To **finish the project**, only these five remaining slices matter — and they are now in the codebase:

1. **Ingest** — upload GeoTIFF to MinIO, save `RasterAsset`, extract CRS/size/bands via Rasterio  
2. **Compare & align** — overlap/CRS/resolution check, processing plan, warp B onto A  
3. **Tiles** — whole-image previews for demo-sized rasters and up to four 768px tiles for larger VLM inputs (optical percentile RGB, SAR dB)  
4. **Analyze** — caption, VQA, grounding (boxes only if the model returns them), classical change map, optical/SAR visualization fusion  
5. **Chat** — `/api/ai/chat` uses Spring AI `ChatClient` + `@Tool` methods. Qwen3 decides which deterministic analysis tool to execute; the selected tool calls the Python service and the final answer is generated from the real result.

### Demo API (after Compose is up)

```bash
curl -X POST http://localhost:8080/api/projects -H "Content-Type: application/json" -d "{\"name\":\"Demo\"}"
curl -X POST http://localhost:8080/api/projects/{projectId}/assets -F "file=@before.tif" -F "modality=OPTICAL"
curl -X POST http://localhost:8080/api/assets/{id}/compatibility/{otherId}
curl -X POST "http://localhost:8080/api/ai/caption?assetId={id}"
curl -X POST "http://localhost:8080/api/ai/change?beforeAssetId={a}&afterAssetId={b}"
curl -X POST http://localhost:8080/api/ai/chat -H "Content-Type: application/json" -d "{\"projectId\":\"...\",\"message\":\"Describe this image\",\"assetIds\":[\"...\"]}"
```

Skipped on purpose: Kafka, Redis, Kubernetes, Prometheus, a second Python service, learned fusion models, and a full eval harness. Those do not block the demo.



## Spring AI chat

Spring AI 2.0.0 is used with the Ollama starter. Spring AI 2.0.x supports Spring Boot 4.0.x and 4.1.x. The current `/api/ai/chat` exposes these tools:

- `analyze_vqa`
- `caption_asset`
- `ground_objects`
- `detect_changes`
- `fuse_optical_sar`
- `get_asset_geospatial_info`

The Docker Compose stack starts Ollama, pulls `qwen3:4b`, then starts Spring Boot. `docker-compose.gpu.yml` enables NVIDIA GPU access for the Python VLM and Ollama when Docker Desktop/Linux NVIDIA support is configured.

Spring AI tool calling is implemented with `ChatClient` and `@Tool`; the application executes the tools and sends their serialized results back to the model for the final response.
