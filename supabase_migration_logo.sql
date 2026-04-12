-- Migration: Okul logosu desteği
-- profiles tablosuna logo_url kolonu ekle
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Supabase Storage: logos bucket oluştur (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload own logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public logos viewable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'logos');

CREATE POLICY "Users can update own logo"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own logo"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);
