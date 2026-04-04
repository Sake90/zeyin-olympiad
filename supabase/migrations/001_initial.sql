-- ZEYIN Olimpyad Platform — Initial Schema
-- Shared with WhatsApp bot (do not rename columns)

-- Enums
CREATE TYPE olympiad_status AS ENUM ('draft', 'registration', 'active', 'finished');
CREATE TYPE participant_language AS ENUM ('kz', 'ru');
CREATE TYPE question_type AS ENUM ('test', 'video', 'task');
CREATE TYPE cert_type AS ENUM ('winner', 'prize', 'participant');

-- ─────────────────────────────────────────────
-- olympiads
-- ─────────────────────────────────────────────
CREATE TABLE olympiads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ru               TEXT NOT NULL,
  name_kz               TEXT NOT NULL,
  subject               TEXT,
  start_time            TIMESTAMPTZ,
  duration_minutes      INT NOT NULL DEFAULT 60,
  status                olympiad_status NOT NULL DEFAULT 'draft',
  intro_video_url       TEXT,
  intro_text_ru         TEXT,
  intro_text_kz         TEXT,
  cert_range_winner_min INT NOT NULL DEFAULT 90,
  cert_range_prize_min  INT NOT NULL DEFAULT 75,
  cert_range_pass_min   INT NOT NULL DEFAULT 50,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- students  (shared with WhatsApp bot)
-- ─────────────────────────────────────────────
CREATE TABLE students (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT NOT NULL,
  school          TEXT,
  grade           TEXT,
  language        participant_language NOT NULL DEFAULT 'ru',
  login           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  password_plain  TEXT NOT NULL,   -- kept for WhatsApp bot delivery
  olympiad_id     UUID REFERENCES olympiads(id) ON DELETE SET NULL,
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  whatsapp        TEXT
);

CREATE INDEX idx_students_login       ON students(login);
CREATE INDEX idx_students_whatsapp    ON students(whatsapp);
CREATE INDEX idx_students_olympiad_id ON students(olympiad_id);

-- ─────────────────────────────────────────────
-- questions
-- ─────────────────────────────────────────────
CREATE TABLE questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  olympiad_id     UUID NOT NULL REFERENCES olympiads(id) ON DELETE CASCADE,
  type            question_type NOT NULL DEFAULT 'test',
  question_ru     TEXT NOT NULL,
  question_kz     TEXT NOT NULL,
  option_a_ru     TEXT NOT NULL,
  option_b_ru     TEXT NOT NULL,
  option_c_ru     TEXT NOT NULL,
  option_d_ru     TEXT NOT NULL,
  option_a_kz     TEXT NOT NULL,
  option_b_kz     TEXT NOT NULL,
  option_c_kz     TEXT NOT NULL,
  option_d_kz     TEXT NOT NULL,
  correct_option  CHAR(1) NOT NULL CHECK (correct_option IN ('a','b','c','d')),
  youtube_url     TEXT,
  image_url       TEXT,
  order_num       INT NOT NULL DEFAULT 1
);

CREATE INDEX idx_questions_olympiad_id ON questions(olympiad_id);
CREATE INDEX idx_questions_order       ON questions(olympiad_id, order_num);

-- ─────────────────────────────────────────────
-- sessions  (server-side timer — not browser)
-- ─────────────────────────────────────────────
CREATE TABLE sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id              UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  olympiad_id             UUID NOT NULL REFERENCES olympiads(id) ON DELETE CASCADE,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  time_remaining_seconds  INT NOT NULL,
  last_question_num       INT NOT NULL DEFAULT 1,
  is_completed            BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(student_id, olympiad_id)
);

-- ─────────────────────────────────────────────
-- answers  (auto-saved on every selection)
-- ─────────────────────────────────────────────
CREATE TABLE answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option CHAR(1) CHECK (selected_option IN ('a','b','c','d')),
  answered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, question_id)
);

CREATE INDEX idx_answers_student_id ON answers(student_id);

-- ─────────────────────────────────────────────
-- results
-- ─────────────────────────────────────────────
CREATE TABLE results (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  olympiad_id      UUID NOT NULL REFERENCES olympiads(id) ON DELETE CASCADE,
  score            INT NOT NULL DEFAULT 0,
  total_questions  INT NOT NULL DEFAULT 0,
  cert_type        cert_type NOT NULL DEFAULT 'participant',
  passed_to_round2 BOOLEAN NOT NULL DEFAULT false,
  completed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, olympiad_id)
);

CREATE INDEX idx_results_olympiad_id ON results(olympiad_id);
CREATE INDEX idx_results_score       ON results(olympiad_id, score DESC);

-- ─────────────────────────────────────────────
-- Row Level Security (RLS)
-- ─────────────────────────────────────────────
-- Students read only their own data (via service role for API routes)
ALTER TABLE olympiads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE students   ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE results    ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS — all API routes use service role key
-- Public read for olympiads (status, start_time needed by frontend)
CREATE POLICY "public_read_olympiads" ON olympiads
  FOR SELECT USING (true);
