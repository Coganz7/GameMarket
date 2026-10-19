-- GAMEVOLT Supabase schema
-- Run in Supabase Dashboard > SQL Editor. Review policies before production launch.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Mobile',
  description text not null default '',
  price integer not null check (price >= 0),
  icon text not null default '✦',
  color text not null default '#0b638e',
  tag text not null default 'DIGITAL',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  game_id text,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  amount integer not null check (amount > 0),
  payment_method text not null default 'qris_manual' check (payment_method in ('qris_manual')),
  payment_status text not null default 'pending' check (payment_status in ('pending','proof_submitted','paid','rejected','refunded')),
  order_status text not null default 'awaiting_payment' check (order_status in ('awaiting_payment','reviewing','processing','completed','cancelled')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists products_active_created_idx on public.products(is_active, created_at desc);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_idx on public.orders(payment_status, order_status);
create index if not exists order_events_order_idx on public.order_events(order_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.store_settings enable row level security;
alter table public.order_events enable row level security;

-- Public can read active catalog only.
drop policy if exists "Public read active products" on public.products;
create policy "Public read active products" on public.products for select to anon, authenticated using (is_active = true);

-- Users can read/update their own profile.
drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile" on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists "Insert own profile" on public.profiles;
create policy "Insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Users can only read their own orders. No browser-side update/delete policy exists.
drop policy if exists "Read own orders" on public.orders;
create policy "Read own orders" on public.orders for select to authenticated using (user_id = auth.uid());

-- Browser inserts are disabled intentionally: create orders through a trusted backend
-- that validates product prices and the user's identity. Do not add a broad anon INSERT policy.
-- Store settings and order events are private; no public policies are created.

-- Seed products for the initial storefront.
insert into public.products (name, category, description, price, icon, color, tag, is_active)
select v.name, v.category, v.description, v.price, v.icon, v.color, v.tag, true
from (values
 ('Diamond Mobile Legends','Mobile','Top up diamond MLBB · nominal pilihan',15000,'💎','#0d75b9','POPULER'),
 ('Free Fire Diamonds','Mobile','Diamond Free Fire untuk item favorit',12000,'🔥','#9d3e18','HOT'),
 ('UC PUBG Mobile','Mobile','Unknown Cash PUBG Mobile',28000,'🎯','#a66b18','HOT'),
 ('Genesis Crystal','Mobile','Crystal untuk petualangan Genshin',25000,'✧','#5543bb','PILIHAN'),
 ('Valorant Points','PC','VP untuk skin dan item Valorant',50000,'⚔','#a52b50','PC'),
 ('Robux Voucher','Voucher','Voucher digital untuk Roblox',18000,'◈','#47617b','VOUCHER')
) as v(name,category,description,price,icon,color,tag)
where not exists (select 1 from public.products p where p.name = v.name);

-- Enable Realtime publication for order updates. Dashboard may show an error if already enabled.
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null;
when undefined_object then raise notice 'Publication supabase_realtime not found; enable Realtime in Supabase Dashboard.';
end $$;
