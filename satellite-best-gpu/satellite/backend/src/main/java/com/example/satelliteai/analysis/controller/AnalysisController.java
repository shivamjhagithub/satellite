package com.example.satelliteai.analysis.controller;

import com.example.satelliteai.analysis.dto.AnalysisResponse;
import com.example.satelliteai.analysis.dto.ChatRequest;
import com.example.satelliteai.analysis.service.ChatService;
import com.example.satelliteai.analysis.service.AnalysisService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class AnalysisController {

	private final AnalysisService analysisService;
	private final ChatService chatService;

	public AnalysisController(AnalysisService analysisService, ChatService chatService) {
		this.analysisService = analysisService;
		this.chatService = chatService;
	}

	@PostMapping("/ai/caption")
	public AnalysisResponse caption(@RequestParam UUID assetId, @RequestParam(required = false) String question) {
		return analysisService.caption(assetId, question);
	}

	@PostMapping("/ai/vqa")
	public AnalysisResponse vqa(@RequestParam UUID assetId, @RequestParam String question) {
		return analysisService.vqa(assetId, question);
	}

	@PostMapping("/ai/ground")
	public AnalysisResponse ground(@RequestParam UUID assetId, @RequestParam String question) {
		return analysisService.ground(assetId, question);
	}

	@PostMapping("/ai/change")
	public AnalysisResponse change(
			@RequestParam UUID beforeAssetId,
			@RequestParam UUID afterAssetId,
			@RequestParam(required = false) String question) {
		return analysisService.change(beforeAssetId, afterAssetId, question);
	}

	@PostMapping("/ai/fusion")
	public AnalysisResponse fusion(
			@RequestParam UUID opticalAssetId,
			@RequestParam UUID sarAssetId,
			@RequestParam(required = false) String question) {
		return analysisService.fusion(opticalAssetId, sarAssetId, question);
	}

	@PostMapping("/ai/chat")
	public AnalysisResponse chat(@Valid @RequestBody ChatRequest request) {
		return chatService.chat(request);
	}

	@GetMapping("/analyses/{id}")
	public AnalysisResponse get(@PathVariable UUID id) {
		return analysisService.get(id);
	}
}
