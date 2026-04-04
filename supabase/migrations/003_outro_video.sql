-- Migration 003: add outro_video_url to olympiads
ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS outro_video_url TEXT;
