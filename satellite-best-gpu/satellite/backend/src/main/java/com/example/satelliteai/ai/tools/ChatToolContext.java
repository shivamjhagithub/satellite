package com.example.satelliteai.ai.tools;

import com.example.satelliteai.analysis.dto.AnalysisResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.context.annotation.RequestScope;

/** Holds the most recent deterministic analysis executed by Spring AI during one chat request. */
@Component
@RequestScope
public class ChatToolContext {

    private AnalysisResponse lastAnalysis;
    private String lastTool;

    public void record(String tool, AnalysisResponse analysis) {
        this.lastTool = tool;
        this.lastAnalysis = analysis;
    }

    public AnalysisResponse getLastAnalysis() {
        return lastAnalysis;
    }

    public String getLastTool() {
        return lastTool;
    }
}
