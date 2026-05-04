-- ZEYIN Trainer (6th grade) — Session 2: time limits + attempt status
-- Olympiad tables are NOT touched.

-- ─────────────────────────────────────────────
-- trainer_tests: optional per-test time limit
-- ─────────────────────────────────────────────
ALTER TABLE trainer_tests
  ADD COLUMN time_limit_minutes INT;
-- NULL = no timer.

-- ─────────────────────────────────────────────
-- trainer_attempts: lifecycle status
-- ─────────────────────────────────────────────
ALTER TABLE trainer_attempts
  ADD COLUMN status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'auto_submitted'));

-- Backfill: any pre-existing rows that already have finished_at + score
-- should be considered submitted. (Foundation migration didn't allow such
-- rows to be created via the API, but be defensive.)
UPDATE trainer_attempts
   SET status = 'submitted'
 WHERE finished_at IS NOT NULL
   AND score IS NOT NULL
   AND status = 'in_progress';

-- Fast lookup of a student's active attempt (used on every catalog load
-- and on every page that resumes a run).
CREATE INDEX idx_trainer_attempts_student_status
  ON trainer_attempts(student_id, status);
