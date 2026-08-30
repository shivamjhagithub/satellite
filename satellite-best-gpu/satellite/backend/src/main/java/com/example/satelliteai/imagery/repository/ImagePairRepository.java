package com.example.satelliteai.imagery.repository;

import com.example.satelliteai.imagery.entity.ImagePair;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ImagePairRepository extends JpaRepository<ImagePair, UUID> {
}
