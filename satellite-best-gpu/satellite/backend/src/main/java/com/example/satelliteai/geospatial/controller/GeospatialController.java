package com.example.satelliteai.geospatial.controller;

import com.example.satelliteai.geospatial.service.GeospatialService;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class GeospatialController {

	private final GeospatialService geospatialService;

	public GeospatialController(GeospatialService geospatialService) {
		this.geospatialService = geospatialService;
	}

	@PostMapping("/assets/{id}/compatibility/{otherId}")
	public Map<String, Object> compatibility(@PathVariable UUID id, @PathVariable UUID otherId) {
		return geospatialService.compatibility(id, otherId);
	}

	@PostMapping("/assets/{id}/processing-plan/{otherId}")
	public Map<String, Object> processingPlan(@PathVariable UUID id, @PathVariable UUID otherId) {
		return geospatialService.processingPlan(id, otherId);
	}

	@PostMapping("/assets/{id}/align/{referenceId}")
	public Map<String, Object> align(@PathVariable UUID id, @PathVariable UUID referenceId) {
		return geospatialService.align(id, referenceId);
	}

	@PostMapping("/assets/{id}/tiles")
	public Map<String, Object> tiles(@PathVariable UUID id) {
		return geospatialService.tiles(id);
	}
}
