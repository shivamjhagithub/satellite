-- Phase 2: metadata only. Raster bytes stay in MinIO (Phase 3), never in these tables.

CREATE TABLE projects (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE raster_assets (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    object_key VARCHAR(1024) NOT NULL UNIQUE,
    original_filename VARCHAR(512) NOT NULL,
    content_type VARCHAR(255),
    file_size BIGINT NOT NULL,
    modality VARCHAR(32) NOT NULL,
    sensor VARCHAR(128),
    platform VARCHAR(128),
    acquisition_time TIMESTAMP WITH TIME ZONE,
    processing_level VARCHAR(64),
    crs TEXT,
    epsg INTEGER,
    width INTEGER,
    height INTEGER,
    band_count INTEGER,
    resolution_x DOUBLE PRECISION,
    resolution_y DOUBLE PRECISION,
    bounds_min_x DOUBLE PRECISION,
    bounds_min_y DOUBLE PRECISION,
    bounds_max_x DOUBLE PRECISION,
    bounds_max_y DOUBLE PRECISION,
    nodata DOUBLE PRECISION,
    transform TEXT,
    metadata_json TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_raster_assets_project_id ON raster_assets (project_id);

CREATE TABLE image_pairs (
    id UUID PRIMARY KEY,
    asset_a_id UUID NOT NULL REFERENCES raster_assets (id) ON DELETE CASCADE,
    asset_b_id UUID NOT NULL REFERENCES raster_assets (id) ON DELETE CASCADE,
    relationship_type VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT image_pairs_distinct_assets CHECK (asset_a_id <> asset_b_id)
);

CREATE INDEX idx_image_pairs_asset_a ON image_pairs (asset_a_id);
CREATE INDEX idx_image_pairs_asset_b ON image_pairs (asset_b_id);
