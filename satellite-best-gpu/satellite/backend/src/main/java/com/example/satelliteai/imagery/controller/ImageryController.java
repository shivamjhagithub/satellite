package com.example.satelliteai.imagery.controller;

import com.example.satelliteai.imagery.Modality;
import com.example.satelliteai.imagery.dto.CreateImagePairRequest;
import com.example.satelliteai.imagery.dto.ImagePairResponse;
import com.example.satelliteai.imagery.dto.RasterAssetResponse;
import com.example.satelliteai.imagery.service.ImagePairService;
import com.example.satelliteai.imagery.service.RasterAssetService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class ImageryController {

	private final RasterAssetService rasterAssetService;
	private final ImagePairService imagePairService;

	public ImageryController(RasterAssetService rasterAssetService, ImagePairService imagePairService) {
		this.rasterAssetService = rasterAssetService;
		this.imagePairService = imagePairService;
	}

	@GetMapping("/projects/{projectId}/assets")
	public List<RasterAssetResponse> listAssets(@PathVariable UUID projectId) {
		return rasterAssetService.listByProject(projectId);
	}

	@PostMapping(path = "/projects/{projectId}/assets", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	public RasterAssetResponse upload(
			@PathVariable UUID projectId,
			@RequestPart("file") MultipartFile file,
			@RequestParam(defaultValue = "UNKNOWN") Modality modality) {
		return rasterAssetService.upload(projectId, file, modality);
	}

	@PostMapping("/assets/{id}/metadata/refresh")
	public RasterAssetResponse refreshMetadata(@PathVariable UUID id) {
		return rasterAssetService.refreshMetadata(id);
	}

	@GetMapping("/assets/{id}")
	public RasterAssetResponse getAsset(@PathVariable UUID id) {
		return rasterAssetService.get(id);
	}

	@PostMapping("/projects/{projectId}/pairs")
	@ResponseStatus(HttpStatus.CREATED)
	public ImagePairResponse createPair(
			@PathVariable UUID projectId,
			@Valid @RequestBody CreateImagePairRequest request) {
		return imagePairService.create(projectId, request);
	}

	@GetMapping("/pairs/{id}")
	public ImagePairResponse getPair(@PathVariable UUID id) {
		return imagePairService.get(id);
	}
}
