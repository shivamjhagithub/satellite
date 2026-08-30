from fastapi import APIRouter

from app.services import pipeline

router = APIRouter()


@router.post("/raster/metadata")
def metadata(body: pipeline.ObjectRef):
    return pipeline.metadata(body.objectKey)


@router.post("/raster/compatibility")
def compatibility(body: pipeline.CompareRequest):
    return pipeline.compatibility(body)


@router.post("/raster/processing-plan")
def processing_plan(body: pipeline.CompareRequest):
    return pipeline.processing_plan(body)


@router.post("/raster/align")
def align(body: pipeline.AlignRequest):
    return pipeline.align(body)


@router.post("/raster/preview")
def preview(body: pipeline.PreviewRequest):
    return pipeline.preview(body)


@router.post("/raster/tiles")
def tiles(body: pipeline.TileRequest):
    return pipeline.tiles(body)


@router.post("/vqa")
def vqa(body: pipeline.VlmRequest):
    return pipeline.vqa(body)


@router.post("/caption")
def caption(body: pipeline.VlmRequest):
    return pipeline.caption(body)


@router.post("/ground")
def ground(body: pipeline.GroundRequest):
    return pipeline.ground(body)


@router.post("/change")
def change(body: pipeline.ChangeRequest):
    return pipeline.change(body)


@router.post("/fusion")
def fusion(body: pipeline.FusionRequest):
    return pipeline.fusion(body)
