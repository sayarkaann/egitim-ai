-- Migration: 7 günlük ücretsiz Pro deneme
-- Tarih: 2026-04-09

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trial_used boolean DEFAULT false;
