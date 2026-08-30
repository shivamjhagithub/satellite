package com.example.satelliteai.ai.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record PythonHealthResponse(
		String status,
		String service,
		String pythonVersion,
		Boolean rasterioAvailable,
		Boolean gdalAvailable,
		String gdalVersion,
		Boolean gpuAvailable,
		Boolean modelLoaded,
		String model
) {
}
