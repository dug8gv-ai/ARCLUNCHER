-- 03_cleanup_duplicate_apps.sql
-- Removes duplicate registered_apps rows per wallet, keeping only the
-- most recently verified row (or most recent if none verified).
--
-- Run this in Supabase SQL Editor ONCE to clean up duplicate entries.

WITH ranked AS (
  SELECT
    id,
    developer_wallet,
    is_verified,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY lower(developer_wallet), lower(app_url)
      ORDER BY
        is_verified DESC,   -- keep verified rows first
        created_at DESC     -- then most recent
    ) AS rn
  FROM public.registered_apps
)
DELETE FROM public.registered_apps
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);
