package com.example.satelliteai.geospatial.service;

import com.example.satelliteai.ai.client.PythonAiClient;
import com.example.satelliteai.imagery.entity.RasterAsset;
import com.example.satelliteai.imagery.service.RasterAssetService;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class GeospatialService {

	private final RasterAssetService rasterAssetService;
	private final PythonAiClient pythonAiClient;

	public GeospatialService(RasterAssetService rasterAssetService, PythonAiClient pythonAiClient) {
		this.rasterAssetService = rasterAssetService;
		this.pythonAiClient = pythonAiClient;
	}

	public Map<String, Object> compatibility(UUID assetId, UUID otherAssetId) {
		RasterAsset a = rasterAssetService.require(assetId);
		RasterAsset b = rasterAssetService.require(otherAssetId);
		return pythonAiClient.compatibility(a.getObjectKey(), b.getObjectKey());
	}

	public Map<String, Object> processingPlan(UUID assetId, UUID otherAssetId) {
		RasterAsset a = rasterAssetService.require(assetId);
		RasterAsset b = rasterAssetService.require(otherAssetId);
		return pythonAiClient.processingPlan(a.getObjectKey(), b.getObjectKey());
	}

	public Map<String, Object> align(UUID sourceId, UUID referenceId) {
		RasterAsset source = rasterAssetService.require(sourceId);
		RasterAsset reference = rasterAssetService.require(referenceId);
		String outputKey = PythonAiClient.outputKey(
				source.getProject().getId(),
				"processed",
				source.getId() + "-aligned-to-" + reference.getId() + ".tif");
		return pythonAiClient.align(source.getObjectKey(), reference.getObjectKey(), outputKey);
	}

	public Map<String, Object> tiles(UUID assetId) {
		RasterAsset asset = rasterAssetService.require(assetId);
		String prefix = PythonAiClient.outputKey(asset.getProject().getId(), "tiles", asset.getId().toString());
		return pythonAiClient.tiles(asset.getObjectKey(), asset.getModality().name(), prefix);
	}
}
