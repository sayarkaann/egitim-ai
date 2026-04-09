-- Migration 3: Sınav Hazırlık özelliği için aylık sayaç kolonları
-- Tarih: 2026-04-09

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS exam_used_month  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exam_reset_at    timestamptz;
