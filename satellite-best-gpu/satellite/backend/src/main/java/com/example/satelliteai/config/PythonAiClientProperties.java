package com.example.satelliteai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.python")
public record PythonAiClientProperties(String baseUrl, java.time.Duration connectTimeout, java.time.Duration readTimeout) {
}
