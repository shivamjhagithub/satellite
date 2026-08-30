package com.example.satelliteai.project.service;

import com.example.satelliteai.common.exception.ApplicationException;
import com.example.satelliteai.common.exception.ErrorCode;
import com.example.satelliteai.project.dto.CreateProjectRequest;
import com.example.satelliteai.project.dto.ProjectResponse;
import com.example.satelliteai.project.entity.Project;
import com.example.satelliteai.project.repository.ProjectRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectService {

	private final ProjectRepository projectRepository;

	public ProjectService(ProjectRepository projectRepository) {
		this.projectRepository = projectRepository;
	}

	@Transactional
	public ProjectResponse create(CreateProjectRequest request) {
		Project project = new Project();
		project.setName(request.name().trim());
		project.setDescription(blankToNull(request.description()));
		return toResponse(projectRepository.save(project));
	}

	@Transactional(readOnly = true)
	public ProjectResponse get(UUID id) {
		return toResponse(require(id));
	}

	@Transactional(readOnly = true)
	public List<ProjectResponse> list() {
		return projectRepository.findAll().stream().map(ProjectService::toResponse).toList();
	}

	@Transactional(readOnly = true)
	public Project require(UUID id) {
		return projectRepository.findById(id)
				.orElseThrow(() -> new ApplicationException(
						ErrorCode.PROJECT_NOT_FOUND,
						"Project not found: " + id,
						HttpStatus.NOT_FOUND));
	}

	private static ProjectResponse toResponse(Project project) {
		return new ProjectResponse(
				project.getId(),
				project.getName(),
				project.getDescription(),
				project.getCreatedAt(),
				project.getUpdatedAt());
	}

	private static String blankToNull(String value) {
		if (value == null || value.isBlank()) {
			return null;
		}
		return value.trim();
	}
}
