package com.example.satelliteai.project.repository;

import com.example.satelliteai.project.entity.Project;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, UUID> {
}
