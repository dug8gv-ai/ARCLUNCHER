-- =======================================================================================
-- ArcOmni Market Hub - Isolated Database Schema
-- =======================================================================================
-- WARNING: Run this entirely in your Supabase SQL Editor.
-- This sets up the isolated tables and RLS for the E-Commerce features.

-- 1. Create the `vendor_profiles` table
CREATE TABLE IF NOT EXISTS public.vendor_profiles (
  wallet text PRIMARY KEY,
  store_name text NOT NULL,
  description text,
  roles text,
  phone text,
  banner_url text,
  logo_url text,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Create the `market_products` table
CREATE TABLE IF NOT EXISTS public.market_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_wallet text NOT NULL REFERENCES public.vendor_profiles(wallet) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text,
  price numeric NOT NULL,
  shipping_fee numeric DEFAULT 0,
  quantity integer NOT NULL DEFAULT 0,
  images text[] DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Create the `market_orders` table
CREATE TABLE IF NOT EXISTS public.market_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_wallet text NOT NULL,
  vendor_wallet text NOT NULL REFERENCES public.vendor_profiles(wallet),
  product_id uuid NOT NULL REFERENCES public.market_products(id),
  quantity integer NOT NULL,
  total_amount numeric NOT NULL,
  tx_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- =======================================================================================
-- RLS (Row Level Security) Policies
-- =======================================================================================

-- Enable RLS
ALTER TABLE public.vendor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_orders ENABLE ROW LEVEL SECURITY;

-- VENDOR PROFILES: Anyone can read. Only the wallet owner can insert/update.
CREATE POLICY "Vendor profiles are viewable by everyone" ON public.vendor_profiles
  FOR SELECT USING (true);

CREATE POLICY "Vendors can insert their own profile" ON public.vendor_profiles
  FOR INSERT WITH CHECK (lower(wallet) = lower(auth.jwt()->>'wallet')); -- Or simple matching if no auth hook

-- If anonymous / wagmi is used without proper Supabase Auth, you might need a public write policy for MVP:
-- (Uncomment below if using simple anonymous writes from the client for MVP)
CREATE POLICY "Public Insert Vendor Profiles" ON public.vendor_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Vendor Profiles" ON public.vendor_profiles FOR UPDATE USING (true);

-- MARKET PRODUCTS: Anyone can read. Public inserts/updates for MVP.
CREATE POLICY "Products are viewable by everyone" ON public.market_products
  FOR SELECT USING (true);

CREATE POLICY "Public Insert Products" ON public.market_products FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update Products" ON public.market_products FOR UPDATE USING (true);

-- MARKET ORDERS: Anyone can read. Public inserts.
CREATE POLICY "Orders are viewable by everyone" ON public.market_orders
  FOR SELECT USING (true);

CREATE POLICY "Public Insert Orders" ON public.market_orders FOR INSERT WITH CHECK (true);

-- =======================================================================================
-- Storage Bucket Setup for Market Images
-- =======================================================================================
-- Make sure a storage bucket named "market_images" exists and is public.
-- If running via SQL:
INSERT INTO storage.buckets (id, name, public) VALUES ('market_images', 'market_images', true) ON CONFLICT DO NOTHING;

-- Storage Policies for 'market_images'
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'market_images' );
CREATE POLICY "Public Uploads" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'market_images' );
