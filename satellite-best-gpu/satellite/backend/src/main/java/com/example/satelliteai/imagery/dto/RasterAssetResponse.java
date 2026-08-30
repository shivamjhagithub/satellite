package com.example.satelliteai.imagery.dto;

import com.example.satelliteai.imagery.Modality;
import java.time.Instant;
import java.util.UUID;

public record RasterAssetResponse(
		UUID id,
		UUID projectId,
		String objectKey,
		String originalFilename,
		String contentType,
		long fileSize,
		Modality modality,
		String sensor,
		String platform,
		Instant acquisitionTime,
		String processingLevel,
		String crs,
		Integer epsg,
		Integer width,
		Integer height,
		Integer bandCount,
		Double resolutionX,
		Double resolutionY,
		Double boundsMinX,
		Double boundsMinY,
		Double boundsMaxX,
		Double boundsMaxY,
		Double nodata,
		String transform,
		String metadataJson,
		Instant createdAt,
		Instant updatedAt
) {
}
