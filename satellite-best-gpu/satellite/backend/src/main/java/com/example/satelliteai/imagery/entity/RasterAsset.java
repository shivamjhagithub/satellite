package com.example.satelliteai.imagery.entity;

import com.example.satelliteai.imagery.Modality;
import com.example.satelliteai.project.entity.Project;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "raster_assets")
public class RasterAsset {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "project_id", nullable = false)
	private Project project;

	@Column(name = "object_key", nullable = false, unique = true, length = 1024)
	private String objectKey;

	@Column(name = "original_filename", nullable = false, length = 512)
	private String originalFilename;

	@Column(name = "content_type")
	private String contentType;

	@Column(name = "file_size", nullable = false)
	private long fileSize;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 32)
	private Modality modality = Modality.UNKNOWN;

	private String sensor;

	private String platform;

	@Column(name = "acquisition_time")
	private Instant acquisitionTime;

	@Column(name = "processing_level")
	private String processingLevel;

	@Column(columnDefinition = "TEXT")
	private String crs;

	private Integer epsg;

	private Integer width;

	private Integer height;

	@Column(name = "band_count")
	private Integer bandCount;

	@Column(name = "resolution_x")
	private Double resolutionX;

	@Column(name = "resolution_y")
	private Double resolutionY;

	@Column(name = "bounds_min_x")
	private Double boundsMinX;

	@Column(name = "bounds_min_y")
	private Double boundsMinY;

	@Column(name = "bounds_max_x")
	private Double boundsMaxX;

	@Column(name = "bounds_max_y")
	private Double boundsMaxY;

	private Double nodata;

	@Column(columnDefinition = "TEXT")
	private String transform;

	@Column(name = "metadata_json", columnDefinition = "TEXT")
	private String metadataJson;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@PrePersist
	void onCreate() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
	}

	@PreUpdate
	void onUpdate() {
		updatedAt = Instant.now();
	}

	public UUID getId() {
		return id;
	}

	public Project getProject() {
		return project;
	}

	public void setProject(Project project) {
		this.project = project;
	}

	public String getObjectKey() {
		return objectKey;
	}

	public void setObjectKey(String objectKey) {
		this.objectKey = objectKey;
	}

	public String getOriginalFilename() {
		return originalFilename;
	}

	public void setOriginalFilename(String originalFilename) {
		this.originalFilename = originalFilename;
	}

	public String getContentType() {
		return contentType;
	}

	public void setContentType(String contentType) {
		this.contentType = contentType;
	}

	public long getFileSize() {
		return fileSize;
	}

	public void setFileSize(long fileSize) {
		this.fileSize = fileSize;
	}

	public Modality getModality() {
		return modality;
	}

	public void setModality(Modality modality) {
		this.modality = modality;
	}

	public String getSensor() {
		return sensor;
	}

	public void setSensor(String sensor) {
		this.sensor = sensor;
	}

	public String getPlatform() {
		return platform;
	}

	public void setPlatform(String platform) {
		this.platform = platform;
	}

	public Instant getAcquisitionTime() {
		return acquisitionTime;
	}

	public void setAcquisitionTime(Instant acquisitionTime) {
		this.acquisitionTime = acquisitionTime;
	}

	public String getProcessingLevel() {
		return processingLevel;
	}

	public void setProcessingLevel(String processingLevel) {
		this.processingLevel = processingLevel;
	}

	public String getCrs() {
		return crs;
	}

	public void setCrs(String crs) {
		this.crs = crs;
	}

	public Integer getEpsg() {
		return epsg;
	}

	public void setEpsg(Integer epsg) {
		this.epsg = epsg;
	}

	public Integer getWidth() {
		return width;
	}

	public void setWidth(Integer width) {
		this.width = width;
	}

	public Integer getHeight() {
		return height;
	}

	public void setHeight(Integer height) {
		this.height = height;
	}

	public Integer getBandCount() {
		return bandCount;
	}

	public void setBandCount(Integer bandCount) {
		this.bandCount = bandCount;
	}

	public Double getResolutionX() {
		return resolutionX;
	}

	public void setResolutionX(Double resolutionX) {
		this.resolutionX = resolutionX;
	}

	public Double getResolutionY() {
		return resolutionY;
	}

	public void setResolutionY(Double resolutionY) {
		this.resolutionY = resolutionY;
	}

	public Double getBoundsMinX() {
		return boundsMinX;
	}

	public void setBoundsMinX(Double boundsMinX) {
		this.boundsMinX = boundsMinX;
	}

	public Double getBoundsMinY() {
		return boundsMinY;
	}

	public void setBoundsMinY(Double boundsMinY) {
		this.boundsMinY = boundsMinY;
	}

	public Double getBoundsMaxX() {
		return boundsMaxX;
	}

	public void setBoundsMaxX(Double boundsMaxX) {
		this.boundsMaxX = boundsMaxX;
	}

	public Double getBoundsMaxY() {
		return boundsMaxY;
	}

	public void setBoundsMaxY(Double boundsMaxY) {
		this.boundsMaxY = boundsMaxY;
	}

	public Double getNodata() {
		return nodata;
	}

	public void setNodata(Double nodata) {
		this.nodata = nodata;
	}

	public String getTransform() {
		return transform;
	}

	public void setTransform(String transform) {
		this.transform = transform;
	}

	public String getMetadataJson() {
		return metadataJson;
	}

	public void setMetadataJson(String metadataJson) {
		this.metadataJson = metadataJson;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
