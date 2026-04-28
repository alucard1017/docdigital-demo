ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS density VARCHAR(20) NOT NULL DEFAULT 'comfortable';