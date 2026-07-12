-- ARTHunt Database Schema
-- Matches the tables the application actually uses (js/db.js):
--   events(id, data, created_at)   — quest config, markers, and player records in `data` JSONB
--   feedback(id, data, created_at) — post-hunt questionnaire ratings in `data` JSONB

-- 1. Events Table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Feedback Table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS Policies
-- The app connects with the anon key only (no auth), so anon needs
-- read/write access to both tables for the demo/research workflow.
-- Tighten these policies if you add Supabase Auth.
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon full access to events" ON public.events
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Anon insert feedback" ON public.feedback
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anon read feedback" ON public.feedback
    FOR SELECT USING (true);

-- 4. Storage
-- Create a PUBLIC bucket named 'ar-assets' via the Supabase Dashboard
-- (used for marker images, 3D models, and live dashcam/selfie photos)
-- and allow anon INSERT on it.
