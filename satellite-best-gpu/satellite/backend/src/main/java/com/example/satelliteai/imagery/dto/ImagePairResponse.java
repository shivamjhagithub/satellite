package com.example.satelliteai.imagery.dto;

import com.example.satelliteai.imagery.RelationshipType;
import java.time.Instant;
import java.util.UUID;

public record ImagePairResponse(
		UUID id,
		UUID assetAId,
		UUID assetBId,
		RelationshipType relationshipType,
		Instant createdAt
) {
}
