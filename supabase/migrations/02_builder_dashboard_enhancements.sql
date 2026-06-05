-- 02_builder_dashboard_enhancements.sql
-- Adds banner_url and sample_images columns required for
-- builder-dashboard-enhancements feature (Requirement 1: Project Verification Persistence)

ALTER TABLE public.registered_apps
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS sample_images text[];
