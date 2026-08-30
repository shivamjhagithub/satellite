package com.example.satelliteai.common.dto;

import com.example.satelliteai.ai.dto.PythonHealthResponse;
import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record HealthResponse(
		String status,
		String service,
		String javaVersion,
		ComponentStatus postgres,
		PythonHealthResponse pythonAiService
) {

	public record ComponentStatus(String status) {
	}
}
