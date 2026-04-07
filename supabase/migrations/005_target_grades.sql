-- Add target_grades to olympiads (e.g. {'5','6'} means for grades 5 and 6)
ALTER TABLE olympiads ADD COLUMN target_grades TEXT[] DEFAULT '{}';
