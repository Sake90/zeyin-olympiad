-- Migration 006: bilingual intro/outro video URLs for olympiads
-- Split single intro_video_url → intro_video_url_ru + intro_video_url_kz
-- Split single outro_video_url → outro_video_url_ru + outro_video_url_kz

-- Intro: rename existing → _ru, add _kz
ALTER TABLE olympiads RENAME COLUMN intro_video_url TO intro_video_url_ru;
ALTER TABLE olympiads ADD COLUMN intro_video_url_kz TEXT;

-- Outro: rename existing → _ru, add _kz
ALTER TABLE olympiads RENAME COLUMN outro_video_url TO outro_video_url_ru;
ALTER TABLE olympiads ADD COLUMN outro_video_url_kz TEXT;
