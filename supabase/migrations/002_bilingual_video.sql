-- Migration 002: bilingual YouTube URLs for video questions
-- Rename youtube_url → youtube_url_ru, add youtube_url_kz

ALTER TABLE questions RENAME COLUMN youtube_url TO youtube_url_ru;
ALTER TABLE questions ADD COLUMN youtube_url_kz TEXT;
