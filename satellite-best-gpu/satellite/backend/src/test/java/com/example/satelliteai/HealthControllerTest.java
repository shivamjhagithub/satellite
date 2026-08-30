package com.example.satelliteai;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class HealthControllerTest {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void healthReturnsStructuredPayloadAndCorrelationId() throws Exception {
		mockMvc.perform(get("/health").header("X-Correlation-Id", "phase1-test"))
				.andExpect(status().isOk())
				.andExpect(header().string("X-Correlation-Id", "phase1-test"))
				.andExpect(jsonPath("$.service").value("backend"))
				.andExpect(jsonPath("$.postgres.status").value("UP"))
				.andExpect(jsonPath("$.pythonAiService.status").value("DOWN"))
				.andExpect(jsonPath("$.pythonAiService.modelLoaded").value(false));
	}
}
