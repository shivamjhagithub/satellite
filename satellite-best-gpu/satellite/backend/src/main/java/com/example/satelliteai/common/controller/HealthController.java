package com.example.satelliteai.common.controller;

import com.example.satelliteai.common.dto.HealthResponse;
import com.example.satelliteai.common.service.HealthService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

	private final HealthService healthService;

	public HealthController(HealthService healthService) {
		this.healthService = healthService;
	}

	@GetMapping("/health")
	public HealthResponse health() {
		return healthService.currentHealth();
	}
}
