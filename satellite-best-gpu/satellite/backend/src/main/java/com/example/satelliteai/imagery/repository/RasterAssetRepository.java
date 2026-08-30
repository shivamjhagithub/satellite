package com.example.satelliteai.imagery.repository;

import com.example.satelliteai.imagery.entity.RasterAsset;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RasterAssetRepository extends JpaRepository<RasterAsset, UUID> {

	List<RasterAsset> findByProject_IdOrderByCreatedAtDesc(UUID projectId);
}
