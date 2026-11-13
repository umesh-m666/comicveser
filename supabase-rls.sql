-- Run once in the Supabase SQL Editor AFTER your data/tables are in place.
-- Turns on row-level security for every table in "public" so Supabase's public REST API cannot read them.
-- Your API connects as the "postgres" user, which bypasses RLS, so the app keeps working.
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;
