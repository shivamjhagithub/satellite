package com.example.satelliteai.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiErrorResponse(
		String errorCode,
		String message,
		String correlationId
) {
}
