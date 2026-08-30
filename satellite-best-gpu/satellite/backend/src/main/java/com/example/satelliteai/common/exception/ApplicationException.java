package com.example.satelliteai.common.exception;

import org.springframework.http.HttpStatus;

public class ApplicationException extends RuntimeException {

	private final ErrorCode errorCode;
	private final HttpStatus httpStatus;

	public ApplicationException(ErrorCode errorCode, String message, HttpStatus httpStatus) {
		super(message);
		this.errorCode = errorCode;
		this.httpStatus = httpStatus;
	}

	public ErrorCode getErrorCode() {
		return errorCode;
	}

	public HttpStatus getHttpStatus() {
		return httpStatus;
	}
}
