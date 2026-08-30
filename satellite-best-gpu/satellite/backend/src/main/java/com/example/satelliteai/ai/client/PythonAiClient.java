package com.example.satelliteai.ai.client;

import com.example.satelliteai.ai.dto.PythonHealthResponse;
import com.example.satelliteai.common.exception.ApplicationException;
import com.example.satelliteai.common.exception.ErrorCode;
import com.example.satelliteai.common.util.CorrelationIdFilter;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Component
public class PythonAiClient {

	private static final Logger log = LoggerFactory.getLogger(PythonAiClient.class);
	private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {
	};

	private final RestClient pythonRestClient;

	public PythonAiClient(@Qualifier("pythonRestClient") RestClient pythonRestClient) {
		this.pythonRestClient = pythonRestClient;
	}

	public Optional<PythonHealthResponse> health() {
		try {
			PythonHealthResponse body = pythonRestClient.get()
					.uri("/health")
					.header(HttpHeaders.ACCEPT, "application/json")
					.headers(this::correlation)
					.retrieve()
					.body(PythonHealthResponse.class);
			return Optional.ofNullable(body);
		} catch (RestClientException ex) {
			log.warn("Python AI service health check failed: {}", ex.getMessage());
			return Optional.empty();
		}
	}

	public Map<String, Object> metadata(String objectKey) {
		return post("/raster/metadata", Map.of("objectKey", objectKey));
	}

	public Map<String, Object> compatibility(String objectKeyA, String objectKeyB) {
		return post("/raster/compatibility", compareBody(objectKeyA, objectKeyB));
	}

	public Map<String, Object> processingPlan(String objectKeyA, String objectKeyB) {
		return post("/raster/processing-plan", compareBody(objectKeyA, objectKeyB));
	}

	public Map<String, Object> align(String sourceKey, String referenceKey, String outputKey) {
		return post("/raster/align", Map.of(
				"source", Map.of("objectKey", sourceKey),
				"reference", Map.of("objectKey", referenceKey),
				"outputObjectKey", outputKey));
	}

	public Map<String, Object> preview(String objectKey, String modality, String outputKey) {
		return post("/raster/preview", Map.of(
				"objectKey", objectKey,
				"modality", modality,
				"outputObjectKey", outputKey));
	}

	public Map<String, Object> tiles(String objectKey, String modality, String outputPrefix) {
		return post("/raster/tiles", Map.of(
				"objectKey", objectKey,
				"modality", modality,
				"tileSize", 512,
				"outputPrefix", outputPrefix));
	}

	public Map<String, Object> vqa(java.util.List<String> objectKeys, String question, String modality) {
		return post("/vqa", Map.of("objectKeys", objectKeys, "question", question, "modality", modality));
	}

	public Map<String, Object> caption(String objectKey, String question, String modality) {
		return post("/caption", Map.of("objectKeys", java.util.List.of(objectKey), "question", question, "modality", modality));
	}

	public Map<String, Object> ground(String objectKey, String question, String modality) {
		return post("/ground", Map.of("objectKey", objectKey, "question", question, "modality", modality));
	}

	public Map<String, Object> change(String objectKeyA, String objectKeyB, String outputKey, String question) {
		return post("/change", Map.of(
				"assetA", Map.of("objectKey", objectKeyA),
				"assetB", Map.of("objectKey", objectKeyB),
				"outputObjectKey", outputKey,
				"question", question));
	}

	public Map<String, Object> fusion(String opticalKey, String sarKey, String outputKey, String question) {
		return post("/fusion", Map.of(
				"optical", Map.of("objectKey", opticalKey),
				"sar", Map.of("objectKey", sarKey),
				"outputObjectKey", outputKey,
				"question", question));
	}

	private Map<String, Object> compareBody(String a, String b) {
		return Map.of(
				"assetA", Map.of("objectKey", a),
				"assetB", Map.of("objectKey", b));
	}

	private Map<String, Object> post(String path, Object body) {
		try {
			Map<String, Object> response = pythonRestClient.post()
					.uri(path)
					.contentType(MediaType.APPLICATION_JSON)
					.headers(this::correlation)
					.body(body)
					.retrieve()
					.body(MAP);
			return response == null ? Map.of() : response;
		} catch (RestClientResponseException ex) {
			log.warn("Python AI service {} failed: {}", path, ex.getMessage());
			throw new ApplicationException(mapStatus(ex.getStatusCode().value()), pythonMessage(ex), httpStatus(ex.getStatusCode().value()));
		} catch (RestClientException ex) {
			log.warn("Python AI service unreachable for {}: {}", path, ex.getMessage());
			throw new ApplicationException(
					ErrorCode.PYTHON_SERVICE_UNAVAILABLE,
					"Python AI service is unavailable.",
					HttpStatus.SERVICE_UNAVAILABLE);
		}
	}

	private void correlation(HttpHeaders headers) {
		String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
		if (correlationId != null) {
			headers.set(CorrelationIdFilter.HEADER, correlationId);
		}
	}

	private static String pythonMessage(RestClientResponseException ex) {
		String body = ex.getResponseBodyAsString();
		if (body != null && body.contains("\"message\"")) {
			int start = body.indexOf("\"message\"");
			int colon = body.indexOf(':', start);
			int firstQuote = body.indexOf('"', colon + 1);
			int secondQuote = body.indexOf('"', firstQuote + 1);
			if (firstQuote > 0 && secondQuote > firstQuote) {
				return body.substring(firstQuote + 1, secondQuote);
			}
		}
		return "Python AI processing failed.";
	}

	private static ErrorCode mapStatus(int status) {
		return switch (status) {
			case 400 -> ErrorCode.INCOMPATIBLE_RASTERS;
			case 404 -> ErrorCode.ASSET_NOT_FOUND;
			case 503 -> ErrorCode.VLM_NOT_AVAILABLE;
			default -> ErrorCode.PYTHON_SERVICE_UNAVAILABLE;
		};
	}

	private static HttpStatus httpStatus(int status) {
		HttpStatus resolved = HttpStatus.resolve(status);
		return resolved == null ? HttpStatus.BAD_GATEWAY : resolved;
	}

	public static String outputKey(UUID projectId, String folder, String filename) {
		return "projects/%s/%s/%s".formatted(projectId, folder, filename);
	}
}
