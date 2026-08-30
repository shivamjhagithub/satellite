package com.example.satelliteai.analysis.repository;

import com.example.satelliteai.analysis.entity.Analysis;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnalysisRepository extends JpaRepository<Analysis, UUID> {
}
