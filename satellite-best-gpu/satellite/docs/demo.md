# Demo flow

1. `docker compose up --build`
2. Create a project: `POST /api/projects`
3. Upload two GeoTIFFs: `POST /api/projects/{id}/assets`
4. Show metadata on `GET /api/assets/{id}` (CRS, size, bands — never invented)
5. `POST /api/assets/{a}/compatibility/{b}` then align if needed
6. `POST /api/ai/caption?assetId=`
7. `POST /api/ai/change?beforeAssetId=&afterAssetId=`
8. Optical + SAR: `POST /api/ai/fusion?opticalAssetId=&sarAssetId=`
9. Optional: `POST /api/ai/chat` with a question and `assetIds`

In GPU mode the AI service preloads Qwen3-VL before the backend becomes healthy. If the model cannot load, `/health` shows `modelLoaded: false` and the backend remains unavailable for VLM operations; the deterministic raster compare/align/change-map code remains independent of VLM inference.
