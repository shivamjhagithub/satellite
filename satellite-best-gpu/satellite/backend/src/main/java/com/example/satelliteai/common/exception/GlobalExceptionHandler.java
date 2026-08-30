package com.example.satelliteai.common.exception;

import com.example.satelliteai.common.response.ApiErrorResponse;
import com.example.satelliteai.common.util.CorrelationIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	@ExceptionHandler(ApplicationException.class)
	public ResponseEntity<ApiErrorResponse> handleApplicationException(ApplicationException ex) {
		log.warn("Application error code={} message={}", ex.getErrorCode(), ex.getMessage());
		return ResponseEntity.status(ex.getHttpStatus())
				.body(new ApiErrorResponse(ex.getErrorCode().name(), ex.getMessage(), correlationId()));
	}

	@ExceptionHandler(org.springframework.web.bind.MethodArgumentNotValidException.class)
	public ResponseEntity<ApiErrorResponse> handleValidation(
			org.springframework.web.bind.MethodArgumentNotValidException ex) {
		String message = ex.getBindingResult().getFieldErrors().stream()
				.findFirst()
				.map(error -> error.getField() + " " + error.getDefaultMessage())
				.orElse("Request validation failed");
		return ResponseEntity.status(HttpStatus.BAD_REQUEST)
				.body(new ApiErrorResponse(ErrorCode.VALIDATION_FAILED.name(), message, correlationId()));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
		log.error("Unhandled error on {}", request.getRequestURI(), ex);
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
				.body(new ApiErrorResponse(
						ErrorCode.INTERNAL_ERROR.name(),
						"An unexpected error occurred.",
						correlationId()));
	}

	private static String correlationId() {
		return MDC.get(CorrelationIdFilter.MDC_KEY);
	}
}
