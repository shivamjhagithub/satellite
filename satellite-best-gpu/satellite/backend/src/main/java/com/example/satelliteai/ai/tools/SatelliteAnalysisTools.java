package com.example.satelliteai.ai.tools;

import com.example.satelliteai.analysis.dto.AnalysisResponse;
import com.example.satelliteai.analysis.service.AnalysisService;
import com.example.satelliteai.imagery.dto.RasterAssetResponse;
import com.example.satelliteai.imagery.service.RasterAssetService;
import java.util.UUID;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

/**
 * Spring AI tools. These methods deliberately delegate to the existing deterministic
 * AnalysisService so the LLM never owns raster processing or authorization logic.
 */
@Component
public class SatelliteAnalysisTools {

    private final AnalysisService analysisService;
    private final RasterAssetService rasterAssetService;
    private final ChatToolContext context;

    public SatelliteAnalysisTools(
            AnalysisService analysisService,
            RasterAssetService rasterAssetService,
            ChatToolContext context) {
        this.analysisService = analysisService;
        this.rasterAssetService = rasterAssetService;
        this.context = context;
    }

    @Tool(name = "analyze_vqa", description = "Answer a visual question about one satellite raster asset. Use for questions such as what is visible, what objects are present, or what the image shows.")
    public AnalysisResponse analyzeVqa(
            @ToolParam(description = "Project UUID that owns the asset") String projectId,
            @ToolParam(description = "Raster asset UUID") String assetId,
            @ToolParam(description = "The user's visual question") String question) {
        UUID project = UUID.fromString(projectId);
        UUID asset = UUID.fromString(assetId);
        assertAssetProject(project, asset);
        AnalysisResponse result = analysisService.vqa(asset, question);
        context.record("vqa", result);
        return result;
    }

    @Tool(name = "caption_asset", description = "Describe a satellite raster image. Use when the user asks for a description, summary, or caption of an image.")
    public AnalysisResponse captionAsset(
            @ToolParam(description = "Project UUID that owns the asset") String projectId,
            @ToolParam(description = "Raster asset UUID") String assetId,
            @ToolParam(description = "Description instruction") String question) {
        UUID project = UUID.fromString(projectId);
        UUID asset = UUID.fromString(assetId);
        assertAssetProject(project, asset);
        AnalysisResponse result = analysisService.caption(asset, question);
        context.record("caption", result);
        return result;
    }

    @Tool(name = "ground_objects", description = "Locate objects in a satellite raster and return geographic detections. Use for where/locate/bounding-box questions.")
    public AnalysisResponse groundObjects(
            @ToolParam(description = "Project UUID that owns the asset") String projectId,
            @ToolParam(description = "Raster asset UUID") String assetId,
            @ToolParam(description = "Object or location question") String question) {
        UUID project = UUID.fromString(projectId);
        UUID asset = UUID.fromString(assetId);
        assertAssetProject(project, asset);
        AnalysisResponse result = analysisService.ground(asset, question);
        context.record("grounding", result);
        return result;
    }

    @Tool(name = "detect_changes", description = "Compare two satellite raster assets and detect changes between them. Use for before/after, difference, construction, land-use change, or change questions.")
    public AnalysisResponse detectChanges(
            @ToolParam(description = "Project UUID that owns both assets") String projectId,
            @ToolParam(description = "Earlier/before raster asset UUID") String beforeAssetId,
            @ToolParam(description = "Later/after raster asset UUID") String afterAssetId,
            @ToolParam(description = "Change analysis question") String question) {
        UUID project = UUID.fromString(projectId);
        UUID before = UUID.fromString(beforeAssetId);
        UUID after = UUID.fromString(afterAssetId);
        assertAssetProject(project, before);
        assertAssetProject(project, after);
        AnalysisResponse result = analysisService.change(before, after, question);
        context.record("change", result);
        return result;
    }

    @Tool(name = "fuse_optical_sar", description = "Combine an optical raster and SAR raster into the project's aligned fusion visualization. Use when the user asks to combine optical and SAR imagery.")
    public AnalysisResponse fuseOpticalSar(
            @ToolParam(description = "Project UUID that owns both assets") String projectId,
            @ToolParam(description = "Optical raster asset UUID") String opticalAssetId,
            @ToolParam(description = "SAR raster asset UUID") String sarAssetId,
            @ToolParam(description = "Fusion interpretation question") String question) {
        UUID project = UUID.fromString(projectId);
        UUID optical = UUID.fromString(opticalAssetId);
        UUID sar = UUID.fromString(sarAssetId);
        assertAssetProject(project, optical);
        assertAssetProject(project, sar);
        AnalysisResponse result = analysisService.fusion(optical, sar, question);
        context.record("fusion", result);
        return result;
    }

    @Tool(name = "get_asset_geospatial_info", description = "Get the stored CRS, EPSG, raster bounds and metadata for a satellite asset. Use when the user asks where an asset is located or about its spatial reference.")
    public RasterAssetResponse getAssetGeospatialInfo(
            @ToolParam(description = "Project UUID that owns the asset") String projectId,
            @ToolParam(description = "Raster asset UUID") String assetId) {
        RasterAssetResponse asset = rasterAssetService.get(UUID.fromString(assetId));
        if (!asset.projectId().equals(UUID.fromString(projectId))) {
            throw new IllegalArgumentException("Asset does not belong to the requested project");
        }
        return asset;
    }

    private void assertAssetProject(UUID projectId, UUID assetId) {
        RasterAssetResponse asset = rasterAssetService.get(assetId);
        if (!projectId.equals(asset.projectId())) {
            throw new IllegalArgumentException("Asset does not belong to the requested project");
        }
    }
}
