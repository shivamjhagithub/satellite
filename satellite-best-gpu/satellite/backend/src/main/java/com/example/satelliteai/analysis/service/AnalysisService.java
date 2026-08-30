package com.example.satelliteai.analysis.service;

import com.example.satelliteai.ai.client.PythonAiClient;
import com.example.satelliteai.analysis.dto.AnalysisResponse;
import com.example.satelliteai.analysis.entity.Analysis;
import com.example.satelliteai.analysis.repository.AnalysisRepository;
import com.example.satelliteai.common.exception.ApplicationException;
import com.example.satelliteai.common.exception.ErrorCode;
import com.example.satelliteai.imagery.entity.RasterAsset;
import com.example.satelliteai.imagery.service.RasterAssetService;
import com.example.satelliteai.project.service.ProjectService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnalysisService {

	private final AnalysisRepository analysisRepository;
	private final ProjectService projectService;
	private final RasterAssetService rasterAssetService;
	private final PythonAiClient pythonAiClient;

	public AnalysisService(
			AnalysisRepository analysisRepository,
			ProjectService projectService,
			RasterAssetService rasterAssetService,
			PythonAiClient pythonAiClient) {
		this.analysisRepository = analysisRepository;
		this.projectService = projectService;
		this.rasterAssetService = rasterAssetService;
		this.pythonAiClient = pythonAiClient;
	}

	@Transactional
	public AnalysisResponse caption(UUID assetId, String question) {
		RasterAsset asset = rasterAssetService.require(assetId);
		String prompt = question == null || question.isBlank()
				? "Describe this satellite image. Separate observations from inferences. Do not invent coordinates."
				: question;
		Map<String, Object> result = pythonAiClient.caption(asset.getObjectKey(), prompt, asset.getModality().name());
		return persist(asset.getProject().getId(), "CAPTION", prompt, result);
	}

	@Transactional
	public AnalysisResponse vqa(UUID assetId, String question) {
		RasterAsset asset = rasterAssetService.require(assetId);
		Map<String, Object> result = pythonAiClient.vqa(List.of(asset.getObjectKey()), question, asset.getModality().name());
		return persist(asset.getProject().getId(), "VQA", question, result);
	}

	@Transactional
	public AnalysisResponse ground(UUID assetId, String question) {
		RasterAsset asset = rasterAssetService.require(assetId);
		Map<String, Object> result = pythonAiClient.ground(asset.getObjectKey(), question, asset.getModality().name());
		return persist(asset.getProject().getId(), "GROUNDING", question, result);
	}

	@Transactional
	public AnalysisResponse change(UUID beforeId, UUID afterId, String question) {
		RasterAsset before = rasterAssetService.require(beforeId);
		RasterAsset after = rasterAssetService.require(afterId);
		String outputKey = PythonAiClient.outputKey(
				before.getProject().getId(),
				"results",
				"change-" + before.getId() + "-" + after.getId() + ".png");
		String prompt = question == null || question.isBlank()
				? "What changed between these two aligned satellite images? Do not invent coordinates."
				: question;
		Map<String, Object> result = pythonAiClient.change(before.getObjectKey(), after.getObjectKey(), outputKey, prompt);
		return persist(before.getProject().getId(), "CHANGE", prompt, result);
	}

	@Transactional
	public AnalysisResponse fusion(UUID opticalId, UUID sarId, String question) {
		RasterAsset optical = rasterAssetService.require(opticalId);
		RasterAsset sar = rasterAssetService.require(sarId);
		String outputKey = PythonAiClient.outputKey(
				optical.getProject().getId(),
				"results",
				"fusion-" + optical.getId() + "-" + sar.getId() + ".png");
		String prompt = question == null || question.isBlank()
				? "Interpret this optical/SAR visualization. Note that the blue channel is SAR, not natural color."
				: question;
		Map<String, Object> result = pythonAiClient.fusion(optical.getObjectKey(), sar.getObjectKey(), outputKey, prompt);
		return persist(optical.getProject().getId(), "FUSION", prompt, result);
	}

	@Transactional
	public AnalysisResponse compatibility(UUID projectId, UUID assetAId, UUID assetBId) {
		RasterAsset a = rasterAssetService.require(assetAId);
		RasterAsset b = rasterAssetService.require(assetBId);
		if (!a.getProject().getId().equals(projectId) || !b.getProject().getId().equals(projectId)) {
			throw new ApplicationException(ErrorCode.VALIDATION_FAILED, "Both assets must belong to the requested project.", HttpStatus.BAD_REQUEST);
		}
		Map<String, Object> raw = pythonAiClient.compatibility(a.getObjectKey(), b.getObjectKey());
		return persist(projectId, "COMPATIBILITY", "Raster compatibility check", raw);
	}


	@Transactional(readOnly = true)
	public AnalysisResponse get(UUID id) {
		Analysis analysis = analysisRepository.findById(id)
				.orElseThrow(() -> new ApplicationException(ErrorCode.ASSET_NOT_FOUND, "Analysis not found: " + id, HttpStatus.NOT_FOUND));
		return toResponse(analysis, Map.of("raw", analysis.getResultJson() == null ? "" : analysis.getResultJson()), null);
	}

	private AnalysisResponse persist(UUID projectId, String type, String question, Map<String, Object> result) {
		Analysis analysis = new Analysis();
		analysis.setProjectId(projectId);
		analysis.setType(type);
		analysis.setQuestion(question);
		Object answer = result.get("answer");
		if (answer == null) {
			answer = result.get("caption");
		}
		analysis.setAnswer(answer == null ? null : String.valueOf(answer));
		analysis.setResultJson(String.valueOf(result));
		analysis = analysisRepository.save(analysis);
		return toResponse(analysis, result, null);
	}

	private static AnalysisResponse toResponse(Analysis analysis, Map<String, Object> result, String tool) {
		return new AnalysisResponse(
				analysis.getId(),
				analysis.getProjectId(),
				analysis.getType(),
				analysis.getQuestion(),
				analysis.getAnswer(),
				result,
				tool,
				analysis.getCreatedAt());
	}

}
