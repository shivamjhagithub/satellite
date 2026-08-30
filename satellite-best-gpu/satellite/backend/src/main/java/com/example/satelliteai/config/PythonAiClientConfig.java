package com.example.satelliteai.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(PythonAiClientProperties.class)
public class PythonAiClientConfig {

	@Bean
	@Qualifier("pythonRestClient")
	public RestClient pythonRestClient(PythonAiClientProperties properties) {
		SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
		factory.setConnectTimeout(properties.connectTimeout());
		factory.setReadTimeout(properties.readTimeout());
		return RestClient.builder()
				.baseUrl(properties.baseUrl())
				.requestFactory(factory)
				.build();
	}
}
