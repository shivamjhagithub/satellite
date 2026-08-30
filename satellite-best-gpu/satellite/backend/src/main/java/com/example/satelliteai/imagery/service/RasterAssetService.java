package com.example.satelliteai.imagery.service;

import com.example.satelliteai.ai.client.PythonAiClient;
import com.example.satelliteai.common.exception.ApplicationException;
import com.example.satelliteai.common.exception.ErrorCode;
import com.example.satelliteai.imagery.Modality;
import com.example.satelliteai.imagery.dto.RasterAssetResponse;
import com.example.satelliteai.imagery.entity.RasterAsset;
import com.example.satelliteai.imagery.repository.RasterAssetRepository;
import com.example.satelliteai.project.entity.Project;
import com.example.satelliteai.project.service.ProjectService;
import com.example.satelliteai.storage.ObjectStorageService;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class RasterAssetService {

	private static final Set<String> ALLOWED_EXTENSIONS = Set.of(".tif", ".tiff");
	private static final long MAX_BYTES = 512L * 1024 * 1024;

	private final RasterAssetRepository rasterAssetRepository;
	private final ProjectService projectService;
	private final ObjectStorageService objectStorageService;
	private final PythonAiClient pythonAiClient;

	public RasterAssetService(
			RasterAssetRepository rasterAssetRepository,
			ProjectService projectService,
			ObjectStorageService objectStorageService,
			PythonAiClient pythonAiClient) {
		this.rasterAssetRepository = rasterAssetRepository;
		this.projectService = projectService;
		this.objectStorageService = objectStorageService;
		this.pythonAiClient = pythonAiClient;
	}

	@Transactional
	public RasterAssetResponse upload(UUID projectId, MultipartFile file, Modality modality) {
		Project project = projectService.require(projectId);
		validateFile(file);
		UUID assetId = UUID.randomUUID();
		String objectKey = "projects/%s/original/%s/%s".formatted(projectId, assetId, sanitize(file.getOriginalFilename()));
		try {
			objectStorageService.put(objectKey, file.getBytes(), file.getContentType() == null ? "image/tiff" : file.getContentType());
		} catch (IOException ex) {
			throw new ApplicationException(ErrorCode.INVALID_FILE, "Could not read the uploaded file.", HttpStatus.BAD_REQUEST);
		}
		RasterAsset asset = new RasterAsset();
		asset.setProject(project);
		asset.setObjectKey(objectKey);
		asset.setOriginalFilename(file.getOriginalFilename());
		asset.setContentType(file.getContentType());
		asset.setFileSize(file.getSize());
		asset.setModality(modality == null ? Modality.UNKNOWN : modality);
		asset = rasterAssetRepository.save(asset);
		applyMetadata(asset, pythonAiClient.metadata(objectKey));
		return toResponse(rasterAssetRepository.save(asset));
	}

	@Transactional
	public RasterAssetResponse refreshMetadata(UUID id) {
		RasterAsset asset = require(id);
		applyMetadata(asset, pythonAiClient.metadata(asset.getObjectKey()));
		return toResponse(rasterAssetRepository.save(asset));
	}

	@Transactional(readOnly = true)
	public RasterAssetResponse get(UUID id) {
		return toResponse(require(id));
	}

	@Transactional(readOnly = true)
	public List<RasterAssetResponse> listByProject(UUID projectId) {
		projectService.require(projectId);
		return rasterAssetRepository.findByProject_IdOrderByCreatedAtDesc(projectId).stream()
				.map(RasterAssetService::toResponse)
				.toList();
	}

	@Transactional(readOnly = true)
	public RasterAsset require(UUID id) {
		return rasterAssetRepository.findById(id)
				.orElseThrow(() -> new ApplicationException(
						ErrorCode.ASSET_NOT_FOUND,
						"Raster asset not found: " + id,
						HttpStatus.NOT_FOUND));
	}

	private void applyMetadata(RasterAsset asset, Map<String, Object> metadata) {
		asset.setCrs(asString(metadata.get("crs")));
		asset.setEpsg(asInt(metadata.get("epsg")));
		asset.setWidth(asInt(metadata.get("width")));
		asset.setHeight(asInt(metadata.get("height")));
		asset.setBandCount(asInt(metadata.get("bandCount")));
		asset.setResolutionX(asDouble(metadata.get("resolutionX")));
		asset.setResolutionY(asDouble(metadata.get("resolutionY")));
		asset.setBoundsMinX(asDouble(metadata.get("boundsMinX")));
		asset.setBoundsMinY(asDouble(metadata.get("boundsMinY")));
		asset.setBoundsMaxX(asDouble(metadata.get("boundsMaxX")));
		asset.setBoundsMaxY(asDouble(metadata.get("boundsMaxY")));
		asset.setNodata(asDouble(metadata.get("nodata")));
		asset.setTransform(asString(metadata.get("transform")));
		asset.setMetadataJson(String.valueOf(metadata));
	}

	private static void validateFile(MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw new ApplicationException(ErrorCode.INVALID_FILE, "A GeoTIFF file is required.", HttpStatus.BAD_REQUEST);
		}
		if (file.getSize() > MAX_BYTES) {
			throw new ApplicationException(ErrorCode.INVALID_FILE, "File exceeds the 512MB upload limit.", HttpStatus.BAD_REQUEST);
		}
		String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
		boolean allowed = ALLOWED_EXTENSIONS.stream().anyMatch(name::endsWith);
		if (!allowed) {
			throw new ApplicationException(ErrorCode.UNSUPPORTED_FORMAT, "Only .tif / .tiff GeoTIFF files are accepted.", HttpStatus.BAD_REQUEST);
		}
	}

	private static String sanitize(String filename) {
		if (filename == null || filename.isBlank()) {
			return "source.tif";
		}
		return filename.replace("\\", "_").replace("/", "_").replace("..", "_");
	}

	private static String asString(Object value) {
		return value == null ? null : String.valueOf(value);
	}

	private static Integer asInt(Object value) {
		if (value instanceof Number number) {
			return number.intValue();
		}
		return null;
	}

	private static Double asDouble(Object value) {
		if (value instanceof Number number) {
			return number.doubleValue();
		}
		return null;
	}

	public static RasterAssetResponse toResponse(RasterAsset asset) {
		return new RasterAssetResponse(
				asset.getId(),
				asset.getProject().getId(),
				asset.getObjectKey(),
				asset.getOriginalFilename(),
				asset.getContentType(),
				asset.getFileSize(),
				asset.getModality(),
				asset.getSensor(),
				asset.getPlatform(),
				asset.getAcquisitionTime(),
				asset.getProcessingLevel(),
				asset.getCrs(),
				asset.getEpsg(),
				asset.getWidth(),
				asset.getHeight(),
				asset.getBandCount(),
				asset.getResolutionX(),
				asset.getResolutionY(),
				asset.getBoundsMinX(),
				asset.getBoundsMinY(),
				asset.getBoundsMaxX(),
				asset.getBoundsMaxY(),
				asset.getNodata(),
				asset.getTransform(),
				asset.getMetadataJson(),
				asset.getCreatedAt(),
				asset.getUpdatedAt());
	}
}
