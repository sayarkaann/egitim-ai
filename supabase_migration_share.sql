-- Migration: Belge paylaşım tablosu
-- Tarih: 2026-04-12

CREATE TABLE IF NOT EXISTS shared_docs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE,
  title       text NOT NULL,
  type        text NOT NULL CHECK (type IN ('pdf', 'word', 'pptx')),
  content     text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

-- Sadece okuma izni (RLS yok, service key ile erişilir)
ALTER TABLE shared_docs ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi paylaşımlarını görebilir
CREATE POLICY "owner_select" ON shared_docs FOR SELECT USING (auth.uid() = user_id);
-- Kullanıcı kendi paylaşımını oluşturabilir
CREATE POLICY "owner_insert" ON shared_docs FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Kullanıcı kendi paylaşımını silebilir
CREATE POLICY "owner_delete" ON shared_docs FOR DELETE USING (auth.uid() = user_id);
