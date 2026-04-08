-- ================================================================
-- EgitimAI — Migration 2: LemonSqueezy kolonları
-- Supabase Dashboard > SQL Editor'da çalıştır
-- ================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS extra_docs              INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_docs_expires_at   TIMESTAMPTZ           DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ls_subscription_id      TEXT                  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ls_customer_id          TEXT                  DEFAULT NULL;
