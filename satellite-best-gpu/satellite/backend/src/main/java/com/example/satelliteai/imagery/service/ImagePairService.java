package com.example.satelliteai.imagery.service;

import com.example.satelliteai.common.exception.ApplicationException;
import com.example.satelliteai.common.exception.ErrorCode;
import com.example.satelliteai.imagery.dto.CreateImagePairRequest;
import com.example.satelliteai.imagery.dto.ImagePairResponse;
import com.example.satelliteai.imagery.entity.ImagePair;
import com.example.satelliteai.imagery.entity.RasterAsset;
import com.example.satelliteai.imagery.repository.ImagePairRepository;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ImagePairService {

	private final ImagePairRepository imagePairRepository;
	private final RasterAssetService rasterAssetService;

	public ImagePairService(ImagePairRepository imagePairRepository, RasterAssetService rasterAssetService) {
		this.imagePairRepository = imagePairRepository;
		this.rasterAssetService = rasterAssetService;
	}

	@Transactional
	public ImagePairResponse create(UUID projectId, CreateImagePairRequest request) {
		if (request.assetAId().equals(request.assetBId())) {
			throw new ApplicationException(
					ErrorCode.INVALID_PAIR,
					"An image pair must reference two different assets.",
					HttpStatus.BAD_REQUEST);
		}
		RasterAsset assetA = rasterAssetService.require(request.assetAId());
		RasterAsset assetB = rasterAssetService.require(request.assetBId());
		if (!assetA.getProject().getId().equals(projectId) || !assetB.getProject().getId().equals(projectId)) {
			throw new ApplicationException(
					ErrorCode.INVALID_PAIR,
					"Both assets must belong to project " + projectId,
					HttpStatus.BAD_REQUEST);
		}
		ImagePair pair = new ImagePair();
		pair.setAssetA(assetA);
		pair.setAssetB(assetB);
		pair.setRelationshipType(request.relationshipType());
		return toResponse(imagePairRepository.save(pair));
	}

	@Transactional(readOnly = true)
	public ImagePairResponse get(UUID id) {
		ImagePair pair = imagePairRepository.findById(id)
				.orElseThrow(() -> new ApplicationException(
						ErrorCode.PAIR_NOT_FOUND,
						"Image pair not found: " + id,
						HttpStatus.NOT_FOUND));
		return toResponse(pair);
	}

	private static ImagePairResponse toResponse(ImagePair pair) {
		return new ImagePairResponse(
				pair.getId(),
				pair.getAssetA().getId(),
				pair.getAssetB().getId(),
				pair.getRelationshipType(),
				pair.getCreatedAt());
	}
}
