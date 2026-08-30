package com.example.satelliteai.analysis.service;

import com.example.satelliteai.ai.tools.ChatToolContext;
import com.example.satelliteai.ai.tools.SatelliteAnalysisTools;
import com.example.satelliteai.analysis.dto.AnalysisResponse;
import com.example.satelliteai.analysis.dto.ChatRequest;
import com.example.satelliteai.project.service.ProjectService;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

@Service
public class ChatService {

    private final ChatClient chatClient;
    private final SatelliteAnalysisTools tools;
    private final ChatToolContext context;
    private final ProjectService projectService;

    public ChatService(ChatClient.Builder chatClientBuilder,
                       SatelliteAnalysisTools tools,
                       ChatToolContext context,
                       ProjectService projectService) {
        this.chatClient = chatClientBuilder.build();
        this.tools = tools;
        this.context = context;
        this.projectService = projectService;
    }

    public AnalysisResponse chat(ChatRequest request) {
        UUID projectId = request.projectId();
        projectService.require(projectId);
        String assets = request.assetIds() == null ? "[]" : request.assetIds().toString();
        String system = """
                You are the orchestration assistant for a satellite geospatial AI application.
                You must use the available tools for satellite-image analysis instead of guessing.
                The current projectId is %s.
                The user supplied assetIds are %s.
                Use only those asset IDs unless a tool explicitly requires another one.
                For visual questions use analyze_vqa; for descriptions use caption_asset; for locating objects use ground_objects;
                for before/after comparisons use detect_changes; for optical+SAR use fuse_optical_sar;
                for CRS/location questions use get_asset_geospatial_info.
                Never invent coordinates, asset IDs, analysis results, or change detections.
                After a tool returns, summarize its result clearly and distinguish detected facts from model interpretation.
                """.formatted(projectId, assets);

        String answer = chatClient.prompt()
                .system(system)
                .user(request.message())
                .tools(tools)
                .call()
                .content();

        AnalysisResponse executed = context.getLastAnalysis();
        if (executed != null) {
            return new AnalysisResponse(
                    executed.id(),
                    executed.projectId(),
                    "CHAT",
                    request.message(),
                    answer,
                    executed.result(),
                    context.getLastTool(),
                    executed.createdAt());
        }
        return new AnalysisResponse(
                null,
                projectId,
                "CHAT",
                request.message(),
                answer,
                Map.of(),
                "chat",
                Instant.now());
    }
}
