package com.example.satelliteai.common.service;

import com.example.satelliteai.ai.client.PythonAiClient;
import com.example.satelliteai.ai.dto.PythonHealthResponse;
import com.example.satelliteai.common.dto.HealthResponse;
import java.sql.Connection;
import javax.sql.DataSource;
import org.springframework.stereotype.Service;

@Service
public class HealthService {

	private final DataSource dataSource;
	private final PythonAiClient pythonAiClient;

	public HealthService(DataSource dataSource, PythonAiClient pythonAiClient) {
		this.dataSource = dataSource;
		this.pythonAiClient = pythonAiClient;
	}

	public HealthResponse currentHealth() {
		HealthResponse.ComponentStatus postgres = postgresStatus();
		PythonHealthResponse python = pythonAiClient.health().orElse(null);
		boolean pythonUp = python != null && "UP".equalsIgnoreCase(python.status());
		String status = "UP".equals(postgres.status()) && pythonUp ? "UP" : "DEGRADED";
		return new HealthResponse(
				status,
				"backend",
				System.getProperty("java.version"),
				postgres,
				python == null
						? new PythonHealthResponse("DOWN", "ai-service", null, null, null, null, null, false, null)
						: python);
	}

	private HealthResponse.ComponentStatus postgresStatus() {
		try (Connection connection = dataSource.getConnection()) {
			boolean valid = connection.isValid(2);
			return new HealthResponse.ComponentStatus(valid ? "UP" : "DOWN");
		} catch (Exception ex) {
			return new HealthResponse.ComponentStatus("DOWN");
		}
	}
}
