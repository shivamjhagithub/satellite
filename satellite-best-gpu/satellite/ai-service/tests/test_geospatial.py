import numpy as np
from rasterio.io import MemoryFile
from rasterio.transform import from_origin

from app.geospatial import raster


def _tif(changed=False):
    arr = np.zeros((3, 100, 100), dtype=np.float32) + 0.2
    arr[:, 20:80, 20:80] = 0.3
    if changed:
        arr[:, 40:70, 40:70] = 0.9
    profile = {
        "driver": "GTiff",
        "height": 100,
        "width": 100,
        "count": 3,
        "dtype": "float32",
        "crs": "EPSG:32644",
        "transform": from_origin(500000, 3200000, 10, 10),
    }
    with MemoryFile() as mem:
        with mem.open(**profile) as dst:
            dst.write(arr)
        return mem.read()


def test_grounding_coordinates_are_real_wgs84_and_area_is_geodesic():
    geometry = raster.pixel_box_to_geojson(_tif(), {"x1": 40, "y1": 40, "x2": 70, "y2": 70})
    assert geometry["crs"] == "EPSG:4326"
    assert -180 <= geometry["centroid"]["longitude"] <= 180
    assert -90 <= geometry["centroid"]["latitude"] <= 90
    assert geometry["areaSquareMeters"] > 0


def test_change_area_and_geojson_use_real_raster_georeferencing():
    before = _tif(False)
    after = _tif(True)
    change_png, stats = raster.change_map(before, after)
    geojson = raster.change_geojson(before, after)

    assert change_png
    assert stats["changedPixelCount"] > 0
    assert geojson["featureCount"] >= 1
    assert geojson["totalAreaSquareMeters"] > 0
    feature = geojson["features"][0]
    assert feature["geometry"]["type"] in {"Polygon", "MultiPolygon"}
    assert feature["properties"]["centroid"] is not None
