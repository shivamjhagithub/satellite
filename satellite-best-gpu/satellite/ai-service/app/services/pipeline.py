from __future__ import annotations

import hashlib
from typing import Any

from pydantic import BaseModel, Field

from app.config import settings
from app.geospatial import raster
from app.storage.minio_store import download_object, upload_object
from app.utils.errors import AppError
from app.vlm.registry import vlm_registry


class ObjectRef(BaseModel):
    objectKey: str


class CompareRequest(BaseModel):
    assetA: ObjectRef
    assetB: ObjectRef


class AlignRequest(BaseModel):
    source: ObjectRef
    reference: ObjectRef
    outputObjectKey: str


class PreviewRequest(BaseModel):
    objectKey: str
    modality: str = "OPTICAL"
    outputObjectKey: str
    bands: dict[str, int] | None = None


class TileRequest(BaseModel):
    objectKey: str
    modality: str = "OPTICAL"
    tileSize: int = 512
    outputPrefix: str
    bands: dict[str, int] | None = None


class ChangeRequest(BaseModel):
    assetA: ObjectRef
    assetB: ObjectRef
    outputObjectKey: str
    question: str | None = None


class FusionRequest(BaseModel):
    optical: ObjectRef
    sar: ObjectRef
    outputObjectKey: str
    question: str | None = None


class VlmRequest(BaseModel):
    objectKeys: list[str] = Field(min_length=1)
    question: str
    modality: str = "OPTICAL"


class GroundRequest(BaseModel):
    objectKey: str
    question: str
    modality: str = "OPTICAL"


def metadata(object_key: str) -> dict[str, Any]:
    return raster.extract_metadata(download_object(object_key))


def compatibility(req: CompareRequest) -> dict[str, Any]:
    a = raster.extract_metadata(download_object(req.assetA.objectKey))
    b = raster.extract_metadata(download_object(req.assetB.objectKey))
    return {"assetA": a, "assetB": b, **raster.compare(a, b)}


def processing_plan(req: CompareRequest) -> dict[str, Any]:
    return compatibility(req)


def align(req: AlignRequest) -> dict[str, Any]:
    source = download_object(req.source.objectKey)
    reference = download_object(req.reference.objectKey)
    aligned = raster.align_bytes(source, reference)
    upload_object(req.outputObjectKey, aligned, "image/tiff")
    return {"objectKey": req.outputObjectKey, **raster.extract_metadata(aligned)}


def preview(req: PreviewRequest) -> dict[str, Any]:
    png = raster.render_preview(download_object(req.objectKey), req.modality, req.bands)
    upload_object(req.outputObjectKey, png, "image/png")
    return {"objectKey": req.outputObjectKey, "contentType": "image/png"}


def tiles(req: TileRequest) -> dict[str, Any]:
    created = []
    for tile in raster.tile_previews(download_object(req.objectKey), req.modality, req.tileSize, req.bands):
        key = f"{req.outputPrefix}/tile-{tile['index']:04d}.png"
        upload_object(key, tile["png"], "image/png")
        created.append({k: v for k, v in tile.items() if k != "png"} | {"objectKey": key})
    return {"tiles": created}




def _geo_reference(object_key: str) -> dict[str, Any] | None:
    data = download_object(object_key)
    reference = raster.extract_metadata(data).get("wgs84")
    if reference:
        reference["coordinateSource"] = "GeoTIFF CRS + affine transform; converted to EPSG:4326"
        reference["isModelGenerated"] = False
    return reference

def _preview_png(object_key: str, modality: str) -> bytes:
    return raster.render_preview(download_object(object_key), modality, None, settings.vlm_tile_size)


def _vlm_tiles(object_key: str, modality: str) -> list[dict[str, Any]]:
    data = download_object(object_key)
    meta = raster.extract_metadata(data)
    # Most demo-sized rasters are better served by one full-resolution VLM image:
    # it avoids multiple sequential GPU generations while preserving global context.
    if max(meta["width"], meta["height"]) <= 1400:
        size = max(meta["width"], meta["height"])
        return [{
            "index": 0,
            "x": 0,
            "y": 0,
            "width": meta["width"],
            "height": meta["height"],
            "boundsMinX": None,
            "boundsMinY": None,
            "boundsMaxX": None,
            "boundsMaxY": None,
            "crs": meta.get("crs"),
            "png": raster.render_preview(data, modality, None, size),
        }]
    tiles = raster.tile_previews(data, modality, settings.vlm_tile_size, None)
    limit = max(1, settings.vlm_max_tiles)
    if len(tiles) <= limit:
        return tiles
    # Spatially distribute the selected tiles instead of taking only the first row.
    # This is critical for large satellite scenes where the target may be anywhere.
    n = len(tiles)
    if limit == 1:
        return [tiles[n // 2]]
    selected_indices = []
    for i in range(limit):
        idx = round(i * (n - 1) / (limit - 1))
        selected_indices.append(idx)
    # Add the center when there is room and remove the least useful duplicate.
    if limit >= 4:
        center_idx = n // 2
        selected_indices[-2] = center_idx
    return [tiles[i] for i in sorted(set(selected_indices))]


def vqa(req: VlmRequest) -> dict[str, Any]:
    images: list[bytes] = []
    tile_counts: dict[str, int] = {}
    for key in req.objectKeys:
        selected = _vlm_tiles(key, req.modality)
        tile_counts[key] = len(selected)
        images.extend(tile["png"] for tile in selected)
    answer = vlm_registry.answer(images, req.question)
    return {
        "answer": answer,
        "model": settings.vlm_model_name,
        "modelLoaded": vlm_registry.is_loaded(),
        "tileCounts": tile_counts,
        "geoReferences": [_geo_reference(key) for key in req.objectKeys],
    }


def caption(req: VlmRequest) -> dict[str, Any]:
    prompt = req.question or "Describe this satellite image. Separate observations from inferences. Do not invent coordinates."
    selected = _vlm_tiles(req.objectKeys[0], req.modality)
    answer = vlm_registry.answer([tile["png"] for tile in selected], prompt)
    return {
        "caption": answer,
        "model": settings.vlm_model_name,
        "modelLoaded": vlm_registry.is_loaded(),
        "tileCount": len(selected),
        "geoReferences": [_geo_reference(req.objectKeys[0])],
    }


def ground(req: GroundRequest) -> dict[str, Any]:
    data = download_object(req.objectKey)
    tiles = _vlm_tiles(req.objectKey, req.modality)
    prompt = (
        req.question
        + " Return one line per detected object using exactly: LABEL [x1,y1,x2,y2]. "
        + "Coordinates are pixel coordinates in the supplied image, with origin at top-left. "
        + "Only return objects that are clearly visible and localizable. Do not invent boxes. "
        + "Do not output latitude, longitude, GeoJSON, or any geographic coordinates."
    )
    detections = []
    for tile in tiles:
        answer = vlm_registry.caption(tile["png"], prompt)
        for parsed in raster.parse_boxes(answer):
            box = {
                "x1": max(0.0, min(float(tile["width"]), parsed["x1"])),
                "y1": max(0.0, min(float(tile["height"]), parsed["y1"])),
                "x2": max(0.0, min(float(tile["width"]), parsed["x2"])),
                "y2": max(0.0, min(float(tile["height"]), parsed["y2"])),
            }
            if box["x2"] <= box["x1"] or box["y2"] <= box["y1"]:
                continue
            source_box = {
                "x1": tile["x"] + box["x1"],
                "y1": tile["y"] + box["y1"],
                "x2": tile["x"] + box["x2"],
                "y2": tile["y"] + box["y2"],
            }
            try:
                geometry = raster.pixel_box_to_geojson(data, source_box)
            except AppError as ex:
                if ex.error_code == "MISSING_CRS":
                    raise
                geometry = None
            label = parsed.get("label") or "Detected object"
            detection = {
                "tileIndex": tile["index"],
                "label": str(label)[:48],
                "pixel": box,
                "sourcePixel": source_box,
                "geometry": geometry,
                "coordinateSource": "GeoTIFF affine transform + source CRS -> EPSG:4326",
                "coordinatesAreModelGenerated": False,
            }
            if geometry:
                detection["location"] = geometry.get("centroid")
                detection["areaSquareMeters"] = geometry.get("areaSquareMeters")
                detection["areaHectares"] = geometry.get("areaHectares")
            detections.append(detection)

    # De-duplicate near-identical boxes from model repetition.
    deduped = []
    for det in detections:
        bx = det["sourcePixel"]
        duplicate = False
        for prev in deduped:
            px = prev["sourcePixel"]
            ix1, iy1 = max(bx["x1"], px["x1"]), max(bx["y1"], px["y1"])
            ix2, iy2 = min(bx["x2"], px["x2"]), min(bx["y2"], px["y2"])
            inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
            a1 = max(1, (bx["x2"] - bx["x1"]) * (bx["y2"] - bx["y1"]))
            a2 = max(1, (px["x2"] - px["x1"]) * (px["y2"] - px["y1"]))
            if inter / min(a1, a2) > 0.85:
                duplicate = True
                break
        if not duplicate:
            deduped.append(det)
    detections = deduped

    base = req.objectKey.rsplit("/", 1)[0] if "/" in req.objectKey else "results"
    suffix = hashlib.sha1((req.objectKey + req.question).encode("utf-8")).hexdigest()[:12]
    overlay_key = base + f"/results/grounding-{suffix}.png"
    overlay = raster.grounding_overlay(data, detections, req.modality)
    upload_object(overlay_key, overlay, "image/png")
    return {
        "answer": "Object grounding completed across %d spatially distributed tiles." % len(tiles),
        "detections": detections,
        "groundingOverlayObjectKey": overlay_key,
        "model": settings.vlm_model_name,
        "modelLoaded": vlm_registry.is_loaded(),
        "tileCount": len(tiles),
        "geoReferences": [_geo_reference(req.objectKey)],
    }

def change(req: ChangeRequest) -> dict[str, Any]:
    a = download_object(req.assetA.objectKey)
    b = download_object(req.assetB.objectKey)
    meta_a = raster.extract_metadata(a)
    meta_b = raster.extract_metadata(b)
    compatibility = raster.compare(meta_a, meta_b)
    if not compatibility["compatible"]:
        raise AppError(400, "INCOMPATIBLE_RASTERS", "; ".join(compatibility["reasons"]) or "Rasters are not geographically compatible.")

    # Align AFTER confirming real geographic overlap/CRS. The reference raster's grid
    # is retained so every changed pixel maps back to the real footprint of asset A.
    aligned = raster.align_bytes(b, a)
    png, stats = raster.change_map(a, aligned)
    upload_object(req.outputObjectKey, png, "image/png")

    geojson = raster.change_geojson(a, aligned)
    geojson_key = req.outputObjectKey.rsplit(".", 1)[0] + ".geojson"
    upload_object(geojson_key, __import__("json").dumps(geojson).encode("utf-8"), "application/geo+json")

    # Exact reported area comes from the WGS84 change polygons, not a naive pixel-area
    # multiplication. This remains correct for geographic rasters and projected rasters
    # with non-metre units.
    stats["changedAreaSquareMeters"] = float(geojson.get("totalAreaSquareMeters", 0.0))
    stats["changedAreaHectares"] = float(geojson.get("totalAreaHectares", 0.0))
    stats["changeFeatureCount"] = int(geojson.get("featureCount", 0))
    stats["changeCentroid"] = geojson.get("centroid")
    stats["coordinateSource"] = "Aligned GeoTIFF grid + affine transform -> EPSG:4326"
    stats["coordinatesAreModelGenerated"] = False

    visual_key = req.outputObjectKey.rsplit("/", 1)[0] + "/change-analysis.png"
    visual = raster.change_visualization(a, aligned, png, geojson)
    upload_object(visual_key, visual, "image/png")

    result: dict[str, Any] = {
        "changeMapObjectKey": req.outputObjectKey,
        "changeVisualizationObjectKey": visual_key,
        "changeGeoJsonObjectKey": geojson_key,
        "changeGeoJson": geojson,
        "geoReferences": [_geo_reference(req.assetA.objectKey), _geo_reference(req.assetB.objectKey)],
        "coordinateSource": "GeoTIFF CRS + affine transform; converted to EPSG:4326",
        "coordinatesAreModelGenerated": False,
        **stats,
    }
    if req.question:
        before_png = raster.render_preview(a, "OPTICAL", None, settings.vlm_tile_size)
        after_png = raster.render_preview(aligned, "OPTICAL", None, settings.vlm_tile_size)
        result["answer"] = vlm_registry.answer(
            [before_png, after_png, png],
            req.question
            + " Compare image 1 (before), image 2 (after), and image 3 (change map). "
              "Describe only visible changes. Do not provide or invent latitude/longitude. "
              "If construction is visible, say likely construction rather than claiming certainty. "
              "Use the supplied change map as evidence, not as a source of geographic coordinates.",
        )
        result["modelLoaded"] = vlm_registry.is_loaded()
    return result

def fusion(req: FusionRequest) -> dict[str, Any]:
    png = raster.fuse_preview(download_object(req.optical.objectKey), download_object(req.sar.objectKey))
    upload_object(req.outputObjectKey, png, "image/png")
    result: dict[str, Any] = {
        "fusionObjectKey": req.outputObjectKey,
        "method": "visualization_channel_stack",
        "note": "Optical R/G plus SAR as blue. This is not learned feature fusion.",
        "geoReferences": [_geo_reference(req.optical.objectKey), _geo_reference(req.sar.objectKey)],
    }
    if req.question:
        result["answer"] = vlm_registry.caption(png, req.question)
        result["modelLoaded"] = vlm_registry.is_loaded()
    return result
