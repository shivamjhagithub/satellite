package com.example.satelliteai.analysis.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;

public record ChatRequest(
        @NotNull UUID projectId,
        @NotBlank String message,
        List<UUID> assetIds) {
}
