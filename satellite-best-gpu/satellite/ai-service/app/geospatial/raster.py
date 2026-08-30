from __future__ import annotations

import json
from typing import Any

import numpy as np

from app.utils.errors import AppError


def require_rasterio():
    try:
        import rasterio
        from rasterio.crs import CRS
        from rasterio.enums import Resampling
        from rasterio.io import MemoryFile
        from rasterio.warp import (
            calculate_default_transform,
            reproject,
            transform_bounds,
        )
        from rasterio.windows import Window
    except Exception as ex:
        raise AppError(
            503,
            "PREPROCESSING_FAILED",
            "Rasterio/GDAL is not installed. Use the Docker AI image, or install GDAL+rasterio.",
        ) from ex
    return rasterio, CRS, Resampling, MemoryFile, calculate_default_transform, reproject, transform_bounds, Window


def _crs_info(crs) -> tuple[str | None, int | None, bool]:
    if crs is None:
        return None, None, True
    epsg = None
    try:
        if crs.to_epsg():
            epsg = int(crs.to_epsg())
    except Exception:
        epsg = None
    text = None
    try:
        text = crs.to_string()
    except Exception:
        text = str(crs)
    return text, epsg, False


def extract_metadata(data: bytes) -> dict[str, Any]:
    rasterio, CRS, Resampling, MemoryFile, calculate_default_transform, reproject, transform_bounds, Window = require_rasterio()
    with rasterio.MemoryFile(data) as mem:
        with mem.open() as src:
            crs_text, epsg, missing_crs = _crs_info(src.crs)
            transform = src.transform
            bounds = src.bounds
            tags = dict(src.tags()) if src.tags() else {}
            descriptions = list(src.descriptions) if src.descriptions else [None] * src.count
            wgs84 = None
            if src.crs is not None:
                try:
                    w = transform_bounds(src.crs, "EPSG:4326", bounds.left, bounds.bottom, bounds.right, bounds.top, densify_pts=21)
                    wgs84 = {
                        "crs": "EPSG:4326",
                        "epsg": 4326,
                        "latitude": float((w[1] + w[3]) / 2.0),
                        "longitude": float((w[0] + w[2]) / 2.0),
                        "boundingBox": {
                            "minLatitude": float(w[1]),
                            "minLongitude": float(w[0]),
                            "maxLatitude": float(w[3]),
                            "maxLongitude": float(w[2]),
                        },
                        "footprint": {
                            "type": "Polygon",
                            "coordinates": [[[float(w[0]), float(w[1])], [float(w[2]), float(w[1])], [float(w[2]), float(w[3])], [float(w[0]), float(w[3])], [float(w[0]), float(w[1])]]],
                        },
                    }
                except Exception:
                    wgs84 = None
            return {
                "crs": crs_text,
                "epsg": epsg,
                "missingCrs": missing_crs,
                "wgs84": wgs84,
                "width": src.width,
                "height": src.height,
                "bandCount": src.count,
                "dtype": str(src.dtypes[0]) if src.count else None,
                "transform": json.dumps(list(transform)[:6]),
                "resolutionX": float(src.res[0]) if src.res else None,
                "resolutionY": float(src.res[1]) if src.res else None,
                "boundsMinX": float(bounds.left),
                "boundsMinY": float(bounds.bottom),
                "boundsMaxX": float(bounds.right),
                "boundsMaxY": float(bounds.top),
                "nodata": src.nodata,
                "driver": src.driver,
                "bandDescriptions": descriptions,
                "tags": tags,
            }


def _bounds_overlap(a: dict[str, Any], b: dict[str, Any]) -> tuple[bool, dict[str, float] | None]:
    rasterio, CRS, Resampling, MemoryFile, calculate_default_transform, reproject, transform_bounds, Window = require_rasterio()
    if a.get("missingCrs") or b.get("missingCrs") or not a.get("crs") or not b.get("crs"):
        # Cannot safely compare geographic overlap without CRS.
        return False, None
    try:
        a_crs = CRS.from_user_input(a["crs"])
        b_crs = CRS.from_user_input(b["crs"])
        b_in_a = transform_bounds(
            b_crs,
            a_crs,
            b["boundsMinX"],
            b["boundsMinY"],
            b["boundsMaxX"],
            b["boundsMaxY"],
        )
    except Exception as ex:
        raise AppError(400, "INCOMPATIBLE_RASTERS", f"Could not compare bounds: {ex}") from ex
    left = max(a["boundsMinX"], b_in_a[0])
    bottom = max(a["boundsMinY"], b_in_a[1])
    right = min(a["boundsMaxX"], b_in_a[2])
    top = min(a["boundsMaxY"], b_in_a[3])
    if left >= right or bottom >= top:
        return False, None
    return True, {"minX": left, "minY": bottom, "maxX": right, "maxY": top}


def compare(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    same_crs = (not a.get("missingCrs") and not b.get("missingCrs") and a.get("crs") == b.get("crs"))
    same_res = (
        a.get("resolutionX") is not None
        and b.get("resolutionX") is not None
        and abs(a["resolutionX"] - b["resolutionX"]) < 1e-6
        and abs((a.get("resolutionY") or 0) - (b.get("resolutionY") or 0)) < 1e-6
    )
    same_size = a.get("width") == b.get("width") and a.get("height") == b.get("height")
    same_transform = a.get("transform") == b.get("transform")
    same_grid = bool(same_crs and same_res and same_size and same_transform)
    overlap, _ = _bounds_overlap(a, b)
    reasons: list[str] = []
    if a.get("missingCrs") or b.get("missingCrs"):
        reasons.append("One or both rasters are missing a CRS; coordinates cannot be compared until a CRS is assigned from real metadata.")
    if not overlap:
        reasons.append("No geographic overlap after transforming bounds to a common CRS.")
    if not same_crs:
        reasons.append("Different CRS; reprojection is required before pixel comparison.")
    if not same_res:
        reasons.append("Different resolution; resampling is required.")
    if overlap and not same_grid:
        reasons.append("Different pixel grids; alignment is required.")
    return {
        "compatible": overlap and not a.get("missingCrs") and not b.get("missingCrs"),
        "overlap": overlap,
        "sameCrs": same_crs,
        "sameResolution": same_res,
        "sameGrid": same_grid,
        "requiresReprojection": overlap and not same_crs,
        "requiresResampling": overlap and not same_res,
        "requiresAlignment": overlap and not same_grid,
        "requiresOverlapCrop": overlap and not same_grid,
        "reasons": reasons,
        "targetCrs": a.get("crs"),
        "targetResolution": a.get("resolutionX"),
        "targetWidth": a.get("width"),
        "targetHeight": a.get("height"),
        "targetTransform": a.get("transform"),
    }


def align_bytes(source: bytes, reference: bytes) -> bytes:
    rasterio, CRS, Resampling, MemoryFile, calculate_default_transform, reproject, transform_bounds, Window = require_rasterio()
    with MemoryFile(reference) as ref_mem, MemoryFile(source) as src_mem:
        with ref_mem.open() as ref, src_mem.open() as src:
            if src.crs is None or ref.crs is None:
                raise AppError(400, "MISSING_CRS", "Both rasters must have a CRS before alignment.")
            dst_crs = ref.crs
            dst_transform = ref.transform
            dst_width = ref.width
            dst_height = ref.height
            count = src.count
            dtype = src.dtypes[0]
            nodata = src.nodata
            dest = np.zeros((count, dst_height, dst_width), dtype=dtype)
            for i in range(1, count + 1):
                reproject(
                    source=rasterio.band(src, i),
                    destination=dest[i - 1],
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=dst_transform,
                    dst_crs=dst_crs,
                    resampling=Resampling.bilinear,
                    src_nodata=nodata,
                    dst_nodata=nodata,
                )
            profile = ref.profile.copy()
            profile.update(count=count, dtype=dtype, nodata=nodata)
            with MemoryFile() as out_mem:
                with out_mem.open(**profile) as dst:
                    dst.write(dest)
                    if src.descriptions:
                        dst.descriptions = src.descriptions
                return out_mem.read()


def _masked_array(src, indexes: list[int]) -> np.ma.MaskedArray:
    arr = src.read(indexes)
    nodata = src.nodata
    mask = np.zeros(arr.shape, dtype=bool)
    if nodata is not None:
        mask |= arr == nodata
    mask |= ~np.isfinite(arr)
    return np.ma.array(arr, mask=mask)


def render_preview(data: bytes, modality: str, bands: dict[str, int] | None, tile_size: int = 768) -> bytes:
    """Render the whole raster into a VLM-friendly RGB PNG.

    The previous implementation cropped the top-left corner. That is fast, but it can
    completely miss the object/change the user is asking about. We instead downsample
    the complete raster to the requested maximum dimension using Rasterio's resampling.
    """
    from PIL import Image

    rasterio, _, Resampling, MemoryFile, *_ = require_rasterio()
    with MemoryFile(data) as mem, mem.open() as src:
        scale = min(1.0, float(tile_size) / max(src.width, src.height))
        out_w = max(1, int(round(src.width * scale)))
        out_h = max(1, int(round(src.height * scale)))

        if modality.upper() == "SAR":
            idx = [1, min(2, src.count), 1] if src.count >= 2 else [1, 1, 1]
        else:
            mapping = bands or {}
            idx = [
                max(1, min(src.count, mapping.get("red", 1))),
                max(1, min(src.count, mapping.get("green", min(2, src.count)))),
                max(1, min(src.count, mapping.get("blue", min(3, src.count)))),
            ]

        arr = src.read(idx, out_shape=(len(idx), out_h, out_w), resampling=Resampling.bilinear).astype("float32")
        nodata = src.nodata
        if nodata is not None:
            arr = np.where(arr == nodata, np.nan, arr)
        if modality.upper() == "SAR":
            arr = np.where(arr > 0, 10.0 * np.log10(arr + 1e-12), np.nan)

        rgb = np.zeros((out_h, out_w, 3), dtype=np.uint8)
        for i in range(3):
            band = arr[i]
            valid = np.isfinite(band)
            if not np.any(valid):
                continue
            lo, hi = np.nanpercentile(band[valid], [2, 98])
            scaled = np.clip((band - lo) / (hi - lo + 1e-6), 0, 1)
            rgb[:, :, i] = np.nan_to_num(scaled * 255, nan=0).astype(np.uint8)

        buf = __import__("io").BytesIO()
        Image.fromarray(rgb, mode="RGB").save(buf, format="PNG", optimize=True)
        return buf.getvalue()


def _rgb_preview_image(data: bytes, modality: str = "OPTICAL", max_size: int = 1024):
    from PIL import Image
    import io
    return Image.open(io.BytesIO(render_preview(data, modality, None, max_size))).convert("RGB")

def tile_previews(data: bytes, modality: str, tile_size: int, bands: dict[str, int] | None) -> list[dict[str, Any]]:
    rasterio, *_rest = require_rasterio()
    Window = _rest[-1]
    tiles: list[dict[str, Any]] = []
    with rasterio.MemoryFile(data) as mem, mem.open() as src:
        index = 0
        for row in range(0, src.height, tile_size):
            for col in range(0, src.width, tile_size):
                w = min(tile_size, src.width - col)
                h = min(tile_size, src.height - row)
                window = Window(col, row, w, h)
                bounds = rasterio.windows.bounds(window, src.transform)
                # Reuse preview renderer on a cropped in-memory geotiff would be heavy;
                # crop bytes via windowed read inside render by writing a tiny VRT-like mem file.
                profile = src.profile.copy()
                profile.update(width=w, height=h, transform=rasterio.windows.transform(window, src.transform))
                crop = src.read(window=window)
                with rasterio.MemoryFile() as crop_mem:
                    with crop_mem.open(**profile) as dst:
                        dst.write(crop)
                    png = render_preview(crop_mem.read(), modality, bands, tile_size=max(w, h))
                tiles.append(
                    {
                        "index": index,
                        "x": col,
                        "y": row,
                        "width": w,
                        "height": h,
                        "boundsMinX": bounds[0],
                        "boundsMinY": bounds[1],
                        "boundsMaxX": bounds[2],
                        "boundsMaxY": bounds[3],
                        "crs": src.crs.to_string() if src.crs else None,
                        "png": png,
                    }
                )
                index += 1
                if index >= 16:
                    return tiles
    return tiles


def _approx_pixel_area_square_meters(src) -> float | None:
    """Return a safe pixel-area estimate in m² for diagnostics only.

    Exact change area is calculated from WGS84 geometries with geodesic area, so this
    value is never used as the authoritative reported area.
    """
    try:
        from pyproj import CRS, Geod
        if src.crs is None:
            return None
        crs = CRS.from_user_input(src.crs)
        if crs.is_projected and crs.axis_info and all("metre" in (a.unit_name or "").lower() for a in crs.axis_info[:2]):
            return abs(float(src.transform.a * src.transform.e))
        # For geographic rasters, estimate the center pixel's geodesic area.
        if crs.is_geographic:
            geod = Geod(ellps="WGS84")
            x0, y0 = src.transform * (src.width / 2.0, src.height / 2.0)
            x1, y1 = src.transform * (src.width / 2.0 + 1.0, src.height / 2.0 + 1.0)
            lons = [x0, x1, x1, x0]
            lats = [y0, y0, y1, y1]
            area, _ = geod.polygon_area_perimeter(lons, lats)
            return abs(float(area))
    except Exception:
        return None
    return None


def _change_mask(aligned_a: bytes, aligned_b: bytes) -> tuple[np.ndarray, np.ndarray, Any, Any, dict[str, Any]]:
    rasterio, *_ = require_rasterio()
    with rasterio.MemoryFile(aligned_a) as a_mem, rasterio.MemoryFile(aligned_b) as b_mem:
        with a_mem.open() as a, b_mem.open() as b:
            if a.width != b.width or a.height != b.height:
                raise AppError(400, "ALIGNMENT_FAILED", "Change map requires aligned rasters with the same grid.")
            # Compare up to the first three bands after per-band normalization. This is
            # much more robust than comparing only band 1 when RGB/NIR GeoTIFFs are used.
            count = min(a.count, b.count, 3)
            aa = a.read(list(range(1, count + 1))).astype("float32")
            bb = b.read(list(range(1, count + 1))).astype("float32")
            mask = np.zeros(aa.shape[1:], dtype=bool)
            for i in range(count):
                if a.nodata is not None:
                    mask |= aa[i] == a.nodata
                if b.nodata is not None:
                    mask |= bb[i] == b.nodata
            mask |= ~np.all(np.isfinite(aa), axis=0) | ~np.all(np.isfinite(bb), axis=0)

            diff_channels = []
            for i in range(count):
                av = aa[i][~mask]
                bv = bb[i][~mask]
                if av.size == 0 or bv.size == 0:
                    diff_channels.append(np.zeros_like(aa[i]))
                    continue
                # Normalize acquisition-to-acquisition radiometric differences with
                # robust median/MAD statistics. Unlike full histogram matching, this
                # does not erase a genuinely new bright/dark object occupying a small
                # part of the scene.
                a_med = float(np.median(av))
                b_med = float(np.median(bv))
                a_mad = float(np.median(np.abs(av - a_med)))
                b_mad = float(np.median(np.abs(bv - b_med)))
                a_iqr = float(np.percentile(av, 75) - np.percentile(av, 25))
                b_iqr = float(np.percentile(bv, 75) - np.percentile(bv, 25))
                a_scale = max(1.4826 * a_mad, a_iqr / 1.349, 1e-6)
                b_scale = max(1.4826 * b_mad, b_iqr / 1.349, 1e-6)
                matched = (bb[i] - b_med) * (a_scale / b_scale) + a_med
                alo, ahi = np.percentile(av, [2, 98])
                an = np.clip((aa[i] - alo) / (ahi - alo + 1e-6), 0, 1)
                # Do not clip the matched image before subtraction: a newly built
                # bright roof can legitimately be outside the historical 2-98% range.
                bn = (matched - alo) / (ahi - alo + 1e-6)
                diff_channels.append(np.clip(np.abs(an - bn), 0, 1))
            diff = np.mean(diff_channels, axis=0)
            valid = diff[~mask]
            if valid.size == 0:
                raise AppError(400, "NO_OVERLAP", "No valid overlapping pixels after nodata masking.")

            # Robust adaptive threshold. Using the 85th percentile alone marks far too
            # much terrain as changed when acquisition conditions differ. The median/MAD
            # term is the primary detector; the high percentile is only a conservative
            # floor so small but real changes can still survive.
            p975 = float(np.percentile(valid, 97.5))
            median = float(np.median(valid))
            mad = float(np.median(np.abs(valid - median))) + 1e-6
            robust_threshold = median + 5.0 * 1.4826 * mad
            threshold = max(0.12, min(0.60, max(robust_threshold, p975 * 0.75)))
            changed = (diff >= threshold) & (~mask)

            # Remove isolated one/two-pixel noise and fill small holes when scipy is available.
            try:
                from scipy import ndimage
                changed = ndimage.binary_opening(changed, structure=np.ones((3, 3)))
                changed = ndimage.binary_closing(changed, structure=np.ones((5, 5)))
                labels, n = ndimage.label(changed)
                if n:
                    sizes = np.bincount(labels.ravel())
                    keep = sizes >= max(16, int(changed.size * 0.00002))
                    keep[0] = False
                    changed = keep[labels]
            except Exception:
                pass

            stats = {
                "method": "robust_radiometric_normalized_multiband_difference_adaptive_threshold",
                "meanAbsDiff": float(diff[~mask].mean()),
                "threshold": threshold,
                "changedFraction": float(changed.sum() / max(1, (~mask).sum())),
                "width": a.width,
                "height": a.height,
                "validPixelCount": int((~mask).sum()),
                "changedPixelCount": int(changed.sum()),
                "crs": a.crs.to_string() if a.crs else None,
                # These are provisional until the actual change polygons are built.
                # The pipeline replaces the area with geodesic polygon area below.
                "pixelAreaSquareMeters": _approx_pixel_area_square_meters(a),
                "changedAreaSquareMeters": 0.0,
                "changedAreaHectares": 0.0,
            }
            return changed, diff, a, b, stats


def change_map(aligned_a: bytes, aligned_b: bytes) -> tuple[bytes, dict[str, Any]]:
    from PIL import Image
    changed, diff, a, b, stats = _change_mask(aligned_a, aligned_b)
    # Match the familiar change-detection presentation: black background, white changed area.
    rgb = np.zeros((changed.shape[0], changed.shape[1], 3), dtype=np.uint8)
    rgb[changed] = 255
    # Downsample only the output visualization, keeping GeoTIFF geometry untouched.
    image = Image.fromarray(rgb, mode="RGB")
    image.thumbnail((1400, 1400), Image.Resampling.BILINEAR)
    buf = __import__("io").BytesIO()
    image.save(buf, format="PNG", optimize=True)
    stats["note"] = "Fast raster change map; semantic interpretation is supplied separately by the VLM when a question is provided."
    return buf.getvalue(), stats


def change_visualization(
    aligned_a: bytes,
    aligned_b: bytes,
    change_png: bytes,
    geojson: dict[str, Any] | None = None,
    max_size: int = 900,
) -> bytes:
    """Create a screenshot-style before/after/change-map result image."""
    from PIL import Image, ImageDraw
    import io

    before = _rgb_preview_image(aligned_a, "OPTICAL", max_size)
    after = _rgb_preview_image(aligned_b, "OPTICAL", max_size)
    change = Image.open(io.BytesIO(change_png)).convert("L")
    change = change.resize(after.size, Image.Resampling.NEAREST)

    # Highlight the detected area on the AFTER image, matching the map-style UI.
    after_marked = after.convert("RGBA")
    overlay = Image.new("RGBA", after.size, (0, 0, 0, 0))
    om = np.array(overlay)
    cm = np.array(change) > 127
    om[cm] = (230, 35, 35, 72)
    overlay = Image.fromarray(om, mode="RGBA")
    after_marked = Image.alpha_composite(after_marked, overlay).convert("RGB")
    d_after = ImageDraw.Draw(after_marked)
    # Draw a red bounding rectangle around the union of changed pixels.
    ys, xs = np.where(cm)
    if len(xs):
        x1, x2 = int(xs.min()), int(xs.max())
        y1, y2 = int(ys.min()), int(ys.max())
        d_after.rectangle((x1, y1, x2, y2), outline=(235, 30, 30), width=max(3, after.width // 220))

    panel_w = max(before.width, after.width, change.width)
    panel_h = max(before.height, after.height, change.height)
    gap = 20
    label_h = 54
    footer_h = 84
    canvas = Image.new("RGB", (panel_w * 3 + gap * 4, panel_h + label_h + footer_h + gap * 2), "white")
    draw = ImageDraw.Draw(canvas)
    panels = [(before, "2024  BEFORE"), (after_marked, "2026  AFTER + DETECTED"), (change.convert("RGB"), "CHANGE MAP")]
    for i, (img, label) in enumerate(panels):
        x = gap + i * (panel_w + gap)
        y = gap + label_h
        canvas.paste(img, (x, y))
        draw.rounded_rectangle((x, gap, x + min(panel_w, 300), gap + 36), radius=10, fill=(15, 39, 75))
        draw.text((x + 10, gap + 9), label, fill="white")

    if geojson:
        area = float(geojson.get("totalAreaHectares") or 0.0)
        count = int(geojson.get("featureCount") or 0)
        centroid = geojson.get("centroid") or {}
        lat = centroid.get("latitude")
        lon = centroid.get("longitude")
        if lat is not None and lon is not None:
            location = f"Detected change: {count} region(s) | {area:.3f} ha | {lat:.6f} N, {lon:.6f} E"
        else:
            location = f"Detected change: {count} region(s) | {area:.3f} ha"
        draw.text((gap, panel_h + label_h + gap + 14), location, fill=(15, 39, 75))
        draw.text((gap, panel_h + label_h + gap + 43), "WGS84 coordinates are derived from GeoTIFF georeferencing, not generated by the VLM.", fill=(55, 65, 80))
    buf = io.BytesIO()
    canvas.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def grounding_overlay(data: bytes, detections: list[dict[str, Any]], modality: str = "OPTICAL", max_size: int = 1200) -> bytes:
    from PIL import Image, ImageDraw
    import io
    image = _rgb_preview_image(data, modality, max_size)
    # Obtain original dimensions for coordinate scaling.
    meta = extract_metadata(data)
    sx = image.width / max(1, meta["width"])
    sy = image.height / max(1, meta["height"])
    draw = ImageDraw.Draw(image)
    for i, det in enumerate(detections, start=1):
        box = det.get("sourcePixel") or det.get("pixel") or {}
        x1, y1 = box.get("x1"), box.get("y1")
        x2, y2 = box.get("x2"), box.get("y2")
        if None in (x1, y1, x2, y2):
            continue
        rect = (int(x1 * sx), int(y1 * sy), int(x2 * sx), int(y2 * sy))
        draw.rectangle(rect, outline=(235, 45, 35), width=max(3, image.width // 350))
        label = str(det.get("label") or f"Object {i}")
        draw.rectangle((rect[0], max(0, rect[1] - 22), rect[0] + max(70, len(label) * 8), rect[1]), fill=(235, 45, 35))
        draw.text((rect[0] + 5, max(0, rect[1] - 20)), label, fill="white")
    buf = io.BytesIO()
    image.save(buf, format="PNG", optimize=True)
    return buf.getvalue()

def fuse_preview(optical: bytes, sar: bytes) -> bytes:
    from PIL import Image

    opt = render_preview(optical, "OPTICAL", None)
    s = render_preview(sar, "SAR", None)
    opt_img = Image.open(__import__("io").BytesIO(opt)).convert("RGB")
    sar_img = Image.open(__import__("io").BytesIO(s)).convert("RGB")
    size = (min(opt_img.width, sar_img.width), min(opt_img.height, sar_img.height))
    opt_img = opt_img.resize(size)
    sar_img = sar_img.resize(size)
    o = np.array(opt_img).astype("float32")
    sv = np.array(sar_img).astype("float32")
    fused = np.zeros_like(o)
    fused[:, :, 0] = o[:, :, 0]
    fused[:, :, 1] = o[:, :, 1]
    fused[:, :, 2] = sv[:, :, 0]
    image = Image.fromarray(fused.astype(np.uint8), mode="RGB")
    buf = __import__("io").BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def pixel_to_geo(data: bytes, x: float, y: float) -> dict[str, float]:
    rasterio, *_ = require_rasterio()
    with rasterio.MemoryFile(data) as mem, mem.open() as src:
        xs, ys = rasterio.transform.xy(src.transform, y, x)
        result = {"x": float(xs), "y": float(ys)}
        if src.crs:
            result["crs"] = src.crs.to_string()
        return result


import re


def parse_boxes(text: str) -> list[dict[str, Any]]:
    """Parse `LABEL [x1,y1,x2,y2]` while retaining the model's label when available."""
    boxes: list[dict[str, Any]] = []
    pattern = re.compile(
        r"(?im)^(?:[-*]\s*)?(?P<label>[^\[\n]{1,80}?)\s*\[(?P<x1>-?\d+(?:\.\d+)?),\s*(?P<y1>-?\d+(?:\.\d+)?),\s*(?P<x2>-?\d+(?:\.\d+)?),\s*(?P<y2>-?\d+(?:\.\d+)?)\]"
    )
    for match in pattern.finditer(text or ""):
        label = re.sub(r"^[0-9.)\s]+", "", match.group("label")).strip(" :-")
        boxes.append({
            "x1": float(match.group("x1")),
            "y1": float(match.group("y1")),
            "x2": float(match.group("x2")),
            "y2": float(match.group("y2")),
            "label": label[:48] or "Detected object",
        })
    # Fallback for models that omit the label or line structure.
    if not boxes:
        for match in re.finditer(r"\[(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\]", text or ""):
            boxes.append({
                "x1": float(match.group(1)), "y1": float(match.group(2)),
                "x2": float(match.group(3)), "y2": float(match.group(4)),
                "label": "Detected object",
            })
    return boxes


def pixel_box_to_geojson(data: bytes, box: dict[str, float]) -> dict[str, Any]:
    rasterio, *_ = require_rasterio()
    with rasterio.MemoryFile(data) as mem, mem.open() as src:
        if src.crs is None:
            raise AppError(400, "MISSING_CRS", "Raster has no CRS; geographic grounding is unavailable.")
        # Pixel coordinates are converted through the actual affine transform. We then
        # transform the resulting source CRS coordinates to WGS84. The VLM never supplies
        # geographic coordinates.
        # Treat model boxes as pixel-edge coordinates, so [40,40,70,70] covers
        # exactly a 30x30-pixel footprint rather than shrinking to pixel centers.
        corners = [
            src.transform * (box["x1"], box["y1"]),
            src.transform * (box["x2"], box["y1"]),
            src.transform * (box["x2"], box["y2"]),
            src.transform * (box["x1"], box["y2"]),
        ]
        from rasterio.warp import transform as warp_transform
        xs = [point[0] for point in corners]
        ys = [point[1] for point in corners]
        lon, lat = warp_transform(src.crs, "EPSG:4326", xs, ys)
        ring = [[float(x), float(y)] for x, y in zip(lon, lat)]
        ring.append(ring[0])
        geometry = {"type": "Polygon", "coordinates": [ring]}
        # Keep the exact image-space polygon as well as the WGS84 polygon.
        # Frontends should draw this pixel polygon directly over the raster preview;
        # it avoids any viewport/lat-lon projection mismatch.
        pixel_ring = [
            [float(box["x1"]), float(box["y1"])],
            [float(box["x2"]), float(box["y1"])],
            [float(box["x2"]), float(box["y2"])],
            [float(box["x1"]), float(box["y2"])],
            [float(box["x1"]), float(box["y1"])],
        ]
        pixel_geometry = {"type": "Polygon", "coordinates": [pixel_ring]}
        area_m2 = _geodesic_geometry_area(geometry)
        centroid = _geometry_centroid_wgs84(geometry)
        return {
            "type": "Polygon",
            "coordinates": [ring],
            "pixelGeometry": pixel_geometry,
            "pixelCoordinates": pixel_ring,
            "crs": "EPSG:4326",
            "centroid": centroid,
            "areaSquareMeters": area_m2,
            "areaHectares": area_m2 / 10000.0 if area_m2 is not None else None,
        }


def _geodesic_geometry_area(geometry: dict[str, Any]) -> float | None:
    try:
        from pyproj import Geod
        from shapely.geometry import shape
        geod = Geod(ellps="WGS84")
        geom = shape(geometry)
        total = 0.0
        if geom.geom_type == "Polygon":
            polys = [geom]
        elif geom.geom_type == "MultiPolygon":
            polys = list(geom.geoms)
        else:
            return 0.0
        for poly in polys:
            exterior = list(poly.exterior.coords)
            area, _ = geod.polygon_area_perimeter([p[0] for p in exterior], [p[1] for p in exterior])
            total += abs(area)
            for hole in poly.interiors:
                coords = list(hole.coords)
                hole_area, _ = geod.polygon_area_perimeter([p[0] for p in coords], [p[1] for p in coords])
                total -= abs(hole_area)
        return max(0.0, float(total))
    except Exception:
        return None


def _geometry_centroid_wgs84(geometry: dict[str, Any]) -> dict[str, float] | None:
    try:
        from shapely.geometry import shape
        point = shape(geometry).centroid
        return {"longitude": float(point.x), "latitude": float(point.y)}
    except Exception:
        return None


def _geometry_to_pixel_geometry(geometry: dict[str, Any], transform) -> dict[str, Any]:
    """Convert raster-space geometry into exact pixel-edge coordinates.

    Rasterio's ``shapes`` returns geometry in the raster CRS. Applying the inverse
    affine transform maps every vertex back to the original image grid, so the
    frontend can draw it directly on a pixel-aligned image without a map projection.
    """
    from shapely.geometry import shape, mapping

    geom = shape(geometry)
    inverse = ~transform

    def convert_ring(ring):
        return [[float(inverse * (float(x), float(y)))[0],
                 float(inverse * (float(x), float(y)))[1]] for x, y in ring]

    def convert_polygon(poly):
        return [convert_ring(poly.exterior.coords)] + [convert_ring(h.coords) for h in poly.interiors]

    if geom.geom_type == "Polygon":
        return {"type": "Polygon", "coordinates": convert_polygon(geom)}
    if geom.geom_type == "MultiPolygon":
        return {"type": "MultiPolygon", "coordinates": [convert_polygon(poly) for poly in geom.geoms]}
    return mapping(geom)


def change_geojson(aligned_a: bytes, aligned_b: bytes) -> dict[str, Any]:
    rasterio, *_ = require_rasterio()
    from rasterio.features import shapes
    from shapely.geometry import shape, mapping
    from rasterio.warp import transform_geom

    changed, _, a, _, _ = _change_mask(aligned_a, aligned_b)
    if a.crs is None:
        raise AppError(400, "MISSING_CRS", "Change GeoJSON requires a CRS.")

    features = []
    min_pixels = max(16, int(changed.size * 0.00002))
    for geom, value in shapes(changed.astype("uint8"), mask=changed, transform=a.transform):
        if int(value) != 1:
            continue
        source_polygon = shape(geom)
        if source_polygon.is_empty or source_polygon.area == 0:
            continue
        if source_polygon.area < abs(float(a.transform.a * a.transform.e)) * min_pixels:
            continue
        geo = geom if a.crs.to_string() == "EPSG:4326" else transform_geom(a.crs, "EPSG:4326", geom, precision=7)
        polygon = shape(geo)
        if polygon.is_empty or polygon.area == 0:
            continue
        geometry = mapping(polygon)
        pixel_geometry = _geometry_to_pixel_geometry(geom, a.transform)
        area_m2 = _geodesic_geometry_area(geometry)
        centroid = _geometry_centroid_wgs84(geometry)
        features.append({
            "type": "Feature",
            "geometry": geometry,
            "pixelGeometry": pixel_geometry,
            "properties": {
                "change": True,
                "type": "detected_change",
                "areaSquareMeters": area_m2,
                "areaHectares": area_m2 / 10000.0 if area_m2 is not None else None,
                "centroid": centroid,
            },
        })
    features.sort(key=lambda f: (f["properties"].get("areaSquareMeters") or 0), reverse=True)
    total_area = sum((f["properties"].get("areaSquareMeters") or 0.0) for f in features)
    centroid = None
    if features:
        # Area-weighted centroid of the detected polygons.
        weighted_lon = weighted_lat = weight = 0.0
        for feature in features:
            c = feature["properties"].get("centroid")
            a_m2 = feature["properties"].get("areaSquareMeters") or 0.0
            if c and a_m2 > 0:
                weighted_lon += c["longitude"] * a_m2
                weighted_lat += c["latitude"] * a_m2
                weight += a_m2
        if weight:
            centroid = {"longitude": weighted_lon / weight, "latitude": weighted_lat / weight}
    return {
        "type": "FeatureCollection",
        "features": features,
        "crs": "EPSG:4326",
        "featureCount": len(features),
        "totalAreaSquareMeters": total_area,
        "totalAreaHectares": total_area / 10000.0,
        "centroid": centroid,
    }

