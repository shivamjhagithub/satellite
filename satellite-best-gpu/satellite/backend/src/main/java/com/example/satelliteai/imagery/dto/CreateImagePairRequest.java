package com.example.satelliteai.imagery.dto;

import com.example.satelliteai.imagery.RelationshipType;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreateImagePairRequest(
		@NotNull UUID assetAId,
		@NotNull UUID assetBId,
		@NotNull RelationshipType relationshipType
) {
}
