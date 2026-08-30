package com.example.satelliteai;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.satelliteai.imagery.Modality;
import com.example.satelliteai.imagery.entity.RasterAsset;
import com.example.satelliteai.imagery.repository.RasterAssetRepository;
import com.example.satelliteai.project.entity.Project;
import com.example.satelliteai.project.repository.ProjectRepository;
import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ProjectAndAssetApiTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ProjectRepository projectRepository;

	@Autowired
	private RasterAssetRepository rasterAssetRepository;

	@Test
	void createAndGetProject() throws Exception {
		MvcResult created = mockMvc.perform(post("/api/projects")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"name":"Hackathon demo","description":"Change detection workspace"}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").exists())
				.andExpect(jsonPath("$.name").value("Hackathon demo"))
				.andReturn();

		String id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

		mockMvc.perform(get("/api/projects/" + id))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.description").value("Change detection workspace"));
	}

	@Test
	void missingProjectReturns404() throws Exception {
		mockMvc.perform(get("/api/projects/" + UUID.randomUUID()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.errorCode").value("PROJECT_NOT_FOUND"));
	}

	@Test
	void blankProjectNameFailsValidation() throws Exception {
		mockMvc.perform(post("/api/projects")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"name":"  "}
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errorCode").value("VALIDATION_FAILED"));
	}

	@Test
	void listAssetsForNewProjectIsEmpty() throws Exception {
		MvcResult created = mockMvc.perform(post("/api/projects")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"name":"Empty project"}
								"""))
				.andExpect(status().isCreated())
				.andReturn();
		String id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

		mockMvc.perform(get("/api/projects/" + id + "/assets"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$").isArray())
				.andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void createPairRequiresTwoAssetsInSameProject() throws Exception {
		Project project = new Project();
		project.setName("Pair workspace");
		project = projectRepository.save(project);

		RasterAsset before = asset(project, "before.tif", "projects/" + project.getId() + "/before.tif");
		RasterAsset after = asset(project, "after.tif", "projects/" + project.getId() + "/after.tif");
		rasterAssetRepository.save(before);
		rasterAssetRepository.save(after);

		mockMvc.perform(post("/api/projects/" + project.getId() + "/pairs")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "assetAId": "%s",
								  "assetBId": "%s",
								  "relationshipType": "TEMPORAL_CHANGE"
								}
								""".formatted(before.getId(), after.getId())))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.relationshipType").value("TEMPORAL_CHANGE"));
	}

	@Test
	void sameAssetPairIsRejected() throws Exception {
		Project project = new Project();
		project.setName("Invalid pair");
		project = projectRepository.save(project);
		RasterAsset asset = rasterAssetRepository.save(
				asset(project, "only.tif", "projects/" + project.getId() + "/only.tif"));

		mockMvc.perform(post("/api/projects/" + project.getId() + "/pairs")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "assetAId": "%s",
								  "assetBId": "%s",
								  "relationshipType": "OTHER"
								}
								""".formatted(asset.getId(), asset.getId())))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errorCode").value("INVALID_PAIR"));
	}

	@Test
	void getMissingAssetReturns404() throws Exception {
		mockMvc.perform(get("/api/assets/" + UUID.randomUUID()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.errorCode").value("ASSET_NOT_FOUND"));
	}

	private static RasterAsset asset(Project project, String filename, String objectKey) {
		RasterAsset asset = new RasterAsset();
		asset.setProject(project);
		asset.setOriginalFilename(filename);
		asset.setObjectKey(objectKey);
		asset.setContentType("image/tiff");
		asset.setFileSize(1024L);
		asset.setModality(Modality.UNKNOWN);
		return asset;
	}
}
