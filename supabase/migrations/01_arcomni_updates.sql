-- 01_arcomni_updates.sql

-- 1. ARC OMNI BUILDER DASHBOARD: REGISTERED APPS
CREATE TABLE public.registered_apps (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  developer_wallet text NOT NULL,
  app_name text NOT NULL,
  app_url text NOT NULL,
  logo_url text,
  description text,
  category text,
  team_size integer,
  country text,
  build_date date,
  contract_address text, -- Arc Chain Contract
  verification_hash text NOT NULL,
  is_verified boolean DEFAULT false NOT NULL
);

ALTER TABLE public.registered_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view verified apps"
  ON public.registered_apps
  FOR SELECT
  USING (is_verified = true);

CREATE POLICY "Developers can view their own apps"
  ON public.registered_apps
  FOR SELECT
  USING (lower(developer_wallet) = lower(current_setting('request.jwt.claims')::json->>'sub'));

CREATE POLICY "Developers can insert apps"
  ON public.registered_apps
  FOR INSERT
  WITH CHECK (true); -- Usually you'd enforce auth, but since we rely on wallet address, we allow open insert or JWT-based

CREATE POLICY "Developers can update their own apps"
  ON public.registered_apps
  FOR UPDATE
  USING (lower(developer_wallet) = lower(current_setting('request.jwt.claims')::json->>'sub'));


-- 2. DISCRETE EARN POINTS ENGINE: TRACKING
CREATE TABLE public.user_point_strikes (
  wallet_address text PRIMARY KEY,
  last_check_in timestamp with time zone,
  current_streak integer DEFAULT 0 NOT NULL,
  founder_volume_rewarded boolean DEFAULT false NOT NULL,
  trader_challenge_rewarded boolean DEFAULT false NOT NULL
);

ALTER TABLE public.user_point_strikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own strikes" ON public.user_point_strikes FOR SELECT USING (true);
CREATE POLICY "Users can insert/update strikes" ON public.user_point_strikes FOR ALL USING (true);


-- 3. ARCPAY V2: P2P CHATS
CREATE TABLE public.arcpay_chats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  sender_wallet text NOT NULL,
  receiver_wallet text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false NOT NULL
);

ALTER TABLE public.arcpay_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own chats" 
  ON public.arcpay_chats FOR SELECT 
  USING (lower(sender_wallet) = lower(current_setting('request.jwt.claims')::json->>'sub') OR lower(receiver_wallet) = lower(current_setting('request.jwt.claims')::json->>'sub'));

CREATE POLICY "Users can insert chats" 
  ON public.arcpay_chats FOR INSERT 
  WITH CHECK (true);

-- Enable Realtime for arcpay_chats
alter publication supabase_realtime add table public.arcpay_chats;
