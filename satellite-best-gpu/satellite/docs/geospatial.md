# Geospatial concepts

This deep-dive is filled in when Rasterio processing lands (Phase 4+). Placeholder so the documented layout exists from Phase 1.

Key rule already in force: **never invent a CRS**. If a GeoTIFF has no CRS, report `missingCrs = true`.
