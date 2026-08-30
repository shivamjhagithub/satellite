package com.example.satelliteai.imagery.entity;

import com.example.satelliteai.imagery.RelationshipType;
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
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "image_pairs")
public class ImagePair {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "asset_a_id", nullable = false)
	private RasterAsset assetA;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "asset_b_id", nullable = false)
	private RasterAsset assetB;

	@Enumerated(EnumType.STRING)
	@Column(name = "relationship_type", nullable = false, length = 32)
	private RelationshipType relationshipType;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@PrePersist
	void onCreate() {
		createdAt = Instant.now();
	}

	public UUID getId() {
		return id;
	}

	public RasterAsset getAssetA() {
		return assetA;
	}

	public void setAssetA(RasterAsset assetA) {
		this.assetA = assetA;
	}

	public RasterAsset getAssetB() {
		return assetB;
	}

	public void setAssetB(RasterAsset assetB) {
		this.assetB = assetB;
	}

	public RelationshipType getRelationshipType() {
		return relationshipType;
	}

	public void setRelationshipType(RelationshipType relationshipType) {
		this.relationshipType = relationshipType;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
