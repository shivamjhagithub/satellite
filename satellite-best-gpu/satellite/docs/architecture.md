# Architecture (Phase 1)

## Why this shape

This is a **modular monolith**, not microservices:

- **Spring Boot** owns HTTP APIs, persistence, MinIO, jobs, and later Spring AI orchestration.
- **One Python FastAPI process** will own Rasterio/GDAL and VLM inference. Pixel math does not belong in Java.
- **PostgreSQL** stores metadata and relationships. Raster bytes never go in the database.
- **MinIO** stores GeoTIFFs, tiles, and result JSON.

Splitting VQA, captioning, grounding, fusion, and change detection into separate services would add network failure modes without helping a hackathon demo.

## Current runtime (Phase 1)

```
USER → Spring Boot GET /health → PostgreSQL ping
                 └→ PythonAiClient GET /health → FastAPI
MinIO is running and will receive files in Phase 3.
```

The Python service preloads the configured Qwen3-VL model at startup. GeoTIFF processing, change detection, grounding, fusion and Spring AI tools are part of the current runtime. The Docker GPU profile waits for the model-loaded health condition before starting Spring Boot, so the first user request does not pay model-loading latency.

Phase 2 adds Postgres tables for **projects**, **raster_assets**, and **image_pairs**. Raster bytes still do not go in the database.

## Data flow later

```
USER → Spring Boot API → AI Assistant → tools → PythonAiClient
  → FastAPI (Rasterio / VLM) → result → PostgreSQL + MinIO → USER
```

## Correlation IDs

Every HTTP request gets `X-Correlation-Id` (incoming or generated). Spring logs it via MDC and forwards it to FastAPI. Never log MinIO keys, DB passwords, or tokens.
