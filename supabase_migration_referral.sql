-- Migration: Referral sistemi
-- Tarih: 2026-04-09

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code   text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by     uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS referral_count  integer DEFAULT 0;

-- Her mevcut kullanıcıya benzersiz referral kodu üret
UPDATE profiles
SET referral_code = substr(md5(id::text || random()::text), 1, 8)
WHERE referral_code IS NULL;
