-- ZEYIN Trainer (6th grade) — Initial schema
-- Lives alongside the olympiad tables in the same Supabase project but is
-- fully isolated: separate students, separate auth, separate cookie.
-- Olympiad tables are NOT touched.

-- ─────────────────────────────────────────────
-- trainer_students
-- ─────────────────────────────────────────────
CREATE TABLE trainer_students (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT NOT NULL,
  class_label     TEXT NOT NULL,                      -- e.g. "6А", "6Б"
  login           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trainer_students_login       ON trainer_students(login);
CREATE INDEX idx_trainer_students_class_label ON trainer_students(class_label);

-- ─────────────────────────────────────────────
-- trainer_tests
-- ─────────────────────────────────────────────
CREATE TABLE trainer_tests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  order_index   INT NOT NULL DEFAULT 0,
  unlock_at     TIMESTAMPTZ,                          -- nullable: null = manual unlock only
  is_unlocked   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trainer_tests_order ON trainer_tests(order_index);

-- ─────────────────────────────────────────────
-- trainer_questions
-- ─────────────────────────────────────────────
CREATE TABLE trainer_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id         UUID NOT NULL REFERENCES trainer_tests(id) ON DELETE CASCADE,
  question_text   TEXT NOT NULL,
  option_a        TEXT NOT NULL,
  option_b        TEXT NOT NULL,
  option_c        TEXT NOT NULL,
  option_d        TEXT NOT NULL,
  correct_option  CHAR(1) NOT NULL CHECK (correct_option IN ('A','B','C','D')),
  explanation     TEXT,
  order_index     INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_trainer_questions_test  ON trainer_questions(test_id);
CREATE INDEX idx_trainer_questions_order ON trainer_questions(test_id, order_index);

-- ─────────────────────────────────────────────
-- trainer_attempts  (one per (student, test) — enforced by UNIQUE)
-- ─────────────────────────────────────────────
CREATE TABLE trainer_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES trainer_students(id) ON DELETE CASCADE,
  test_id       UUID NOT NULL REFERENCES trainer_tests(id)    ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  score         INT,
  UNIQUE(student_id, test_id)
);

CREATE INDEX idx_trainer_attempts_student ON trainer_attempts(student_id);
CREATE INDEX idx_trainer_attempts_test    ON trainer_attempts(test_id);

-- ─────────────────────────────────────────────
-- trainer_answers
-- ─────────────────────────────────────────────
CREATE TABLE trainer_answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id      UUID NOT NULL REFERENCES trainer_attempts(id)  ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES trainer_questions(id) ON DELETE CASCADE,
  selected_option CHAR(1) NOT NULL CHECK (selected_option IN ('A','B','C','D')),
  is_correct      BOOLEAN NOT NULL,
  UNIQUE(attempt_id, question_id)
);

CREATE INDEX idx_trainer_answers_attempt  ON trainer_answers(attempt_id);
CREATE INDEX idx_trainer_answers_question ON trainer_answers(question_id);

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
-- All API routes use the Supabase service role key, which bypasses RLS by
-- design. Enabling RLS without permissive policies locks anon/authenticated
-- out — exactly what we want for now. Real per-student policies will be
-- added later, once the access patterns are settled.
ALTER TABLE trainer_students  ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_tests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_attempts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_answers   ENABLE ROW LEVEL SECURITY;
