-- Analysis results from VQA, caption, change, and fusion.

CREATE TABLE analyses (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    question TEXT,
    answer TEXT,
    result_json TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_analyses_project_id ON analyses (project_id);
