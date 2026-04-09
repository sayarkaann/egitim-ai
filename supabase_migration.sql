-- ================================================================
-- EgitimAI — Supabase Migration
-- Supabase Dashboard > SQL Editor'da çalıştır
-- ================================================================

-- 1. profiles tablosu
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                TEXT        NOT NULL DEFAULT 'free'
                                  CHECK (plan IN ('free', 'ogrenci', 'pro', 'kurumsal')),
  plan_expires_at     TIMESTAMPTZ,
  docs_used_month     INT         NOT NULL DEFAULT 0,
  docs_reset_at       TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  analyze_used_month  INT         NOT NULL DEFAULT 0,
  analyze_reset_at    TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Kullanici kendi profilini okuyabilir" ON public.profiles;
CREATE POLICY "Kullanici kendi profilini okuyabilir"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Kullanici kendi profilini guncelleyebilir" ON public.profiles;
CREATE POLICY "Kullanici kendi profilini guncelleyebilir"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Service role (backend) her şeyi yapabilir — RLS bypass
-- Bu zaten varsayılan: service_role politikadan muaf

-- 3. Yeni kullanıcı kaydında otomatik profil oluştur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Mevcut kullanıcılar için profil oluştur (varsa boşlukları doldur)
INSERT INTO public.profiles (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;
