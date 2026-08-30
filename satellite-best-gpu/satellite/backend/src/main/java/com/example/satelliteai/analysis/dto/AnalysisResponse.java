package com.example.satelliteai.analysis.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record AnalysisResponse(
		UUID id,
		UUID projectId,
		String type,
		String question,
		String answer,
		Map<String, Object> result,
		String routedTool,
		Instant createdAt
) {
}
