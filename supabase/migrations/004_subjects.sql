-- Migration 004: subjects per olympiad + per-result subject scores
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '[]';
ALTER TABLE results ADD COLUMN IF NOT EXISTS subject_scores JSONB DEFAULT '[]';
