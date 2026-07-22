-- =============================================================================
-- LivrExpress — Schéma Supabase (Auth + données métier)
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- PROFILES (lié à auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  name text not null default '',
  phone text default '',
  address text default '',
  role text not null default 'client'
    check (role in ('client', 'admin', 'super_admin')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (email);

-- -----------------------------------------------------------------------------
-- ORDER REQUESTS (demandes client avant validation)
-- -----------------------------------------------------------------------------
create table if not exists public.order_requests (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_email text not null default '',
  user_name text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  plan text not null default 'Express',
  pricing jsonb not null default '{}'::jsonb,
  sender jsonb not null default '{}'::jsonb,
  recipient jsonb not null default '{}'::jsonb,
  package jsonb not null default '{}'::jsonb,
  notes text default '',
  tracking_id text,
  reject_reason text default '',
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_requests_user_idx on public.order_requests (user_id);
create index if not exists order_requests_status_idx on public.order_requests (status);
create index if not exists order_requests_created_idx on public.order_requests (created_at desc);

-- -----------------------------------------------------------------------------
-- SHIPMENTS (colis / suivi)
-- -----------------------------------------------------------------------------
create table if not exists public.shipments (
  tracking_id text primary key,
  order_request_id text references public.order_requests (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  user_email text default '',
  status_key text not null default 'confirmed',
  plan text not null default 'Express',
  pricing jsonb not null default '{}'::jsonb,
  sender jsonb not null default '{}'::jsonb,
  recipient jsonb not null default '{}'::jsonb,
  package jsonb not null default '{}'::jsonb,
  courier jsonb,
  eta timestamptz,
  eta_label text default '',
  events jsonb not null default '[]'::jsonb,
  step_times jsonb not null default '{}'::jsonb,
  notes text default '',
  source text default 'order',
  service_level text default 'Express',
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shipments_user_idx on public.shipments (user_id);
create index if not exists shipments_status_idx on public.shipments (status_key);
create index if not exists shipments_created_idx on public.shipments (created_at desc);

-- Lien optionnel order → tracking
create index if not exists order_requests_tracking_idx
  on public.order_requests (tracking_id);

-- -----------------------------------------------------------------------------
-- NOTIFICATIONS client
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null default 'info',
  title text not null default 'LivrExpress',
  message text not null default '',
  tracking_id text,
  order_id text,
  status_key text,
  icon text default '📦',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id, read)
  where read = false;

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists order_requests_updated_at on public.order_requests;
create trigger order_requests_updated_at
  before update on public.order_requests
  for each row execute function public.set_updated_at();

drop trigger if exists shipments_updated_at on public.shipments;
create trigger shipments_updated_at
  before update on public.shipments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Auto-création profil à l'inscription Auth
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_phone text;
  v_address text;
  v_role text;
  v_email text;
begin
  v_email := lower(coalesce(new.email, ''));
  v_name := coalesce(new.raw_user_meta_data->>'name', split_part(v_email, '@', 1));
  v_phone := coalesce(new.raw_user_meta_data->>'phone', '');
  v_address := coalesce(new.raw_user_meta_data->>'address', '');

  -- Toujours client à l'inscription publique (pas d'auto-promotion)
  -- Le super-admin est fixé par email ; les co-admins sont promus ensuite.
  v_role := 'client';
  if v_email = 'michelndathi@gmail.com' then
    v_role := 'super_admin';
  end if;

  insert into public.profiles (id, email, name, phone, address, role)
  values (new.id, v_email, v_name, v_phone, v_address, v_role)
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(nullif(excluded.name, ''), public.profiles.name),
        phone = coalesce(nullif(excluded.phone, ''), public.profiles.phone),
        address = coalesce(nullif(excluded.address, ''), public.profiles.address),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Helpers RLS
-- -----------------------------------------------------------------------------
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.order_requests enable row level security;
alter table public.shipments enable row level security;
alter table public.notifications enable row level security;

-- Profiles
drop policy if exists "profiles_select_own_or_staff" on public.profiles;
create policy "profiles_select_own_or_staff"
  on public.profiles for select
  using (auth.uid() = id or public.is_staff());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_staff_update" on public.profiles;
create policy "profiles_staff_update"
  on public.profiles for update
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "profiles_super_insert_admin" on public.profiles;
-- Les profils sont créés via trigger (security definer) — pas d'insert public

-- Order requests
drop policy if exists "orders_select_own_or_staff" on public.order_requests;
create policy "orders_select_own_or_staff"
  on public.order_requests for select
  using (auth.uid() = user_id or public.is_staff());

drop policy if exists "orders_insert_own" on public.order_requests;
create policy "orders_insert_own"
  on public.order_requests for insert
  with check (auth.uid() = user_id);

drop policy if exists "orders_update_own_pending" on public.order_requests;
create policy "orders_update_own_pending"
  on public.order_requests for update
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id);

drop policy if exists "orders_staff_all" on public.order_requests;
create policy "orders_staff_all"
  on public.order_requests for all
  using (public.is_staff())
  with check (public.is_staff());

-- Shipments : lecture publique par tracking (suivi sans login) + propriétaire + staff
drop policy if exists "shipments_select_public_or_owner" on public.shipments;
create policy "shipments_select_public_or_owner"
  on public.shipments for select
  using (
    true  -- suivi public par n° (comme l'app actuelle)
  );

drop policy if exists "shipments_insert_staff" on public.shipments;
create policy "shipments_insert_staff"
  on public.shipments for insert
  with check (public.is_staff() or auth.uid() = user_id);

drop policy if exists "shipments_update_staff" on public.shipments;
create policy "shipments_update_staff"
  on public.shipments for update
  using (public.is_staff())
  with check (public.is_staff());

-- Notifications
drop policy if exists "notif_select_own" on public.notifications;
create policy "notif_select_own"
  on public.notifications for select
  using (auth.uid() = user_id or public.is_staff());

drop policy if exists "notif_insert_staff_or_system" on public.notifications;
create policy "notif_insert_staff_or_system"
  on public.notifications for insert
  with check (public.is_staff() or auth.uid() = user_id);

drop policy if exists "notif_update_own" on public.notifications;
create policy "notif_update_own"
  on public.notifications for update
  using (auth.uid() = user_id or public.is_staff())
  with check (auth.uid() = user_id or public.is_staff());

-- -----------------------------------------------------------------------------
-- Realtime (optionnel : suivi live multi-appareils)
-- -----------------------------------------------------------------------------
-- Dashboard → Database → Replication : activer pour shipments / notifications
-- ou décommenter si la publication supabase_realtime existe :
-- alter publication supabase_realtime add table public.shipments;
-- alter publication supabase_realtime add table public.notifications;
-- alter publication supabase_realtime add table public.order_requests;

-- -----------------------------------------------------------------------------
-- Notes super-admin
-- -----------------------------------------------------------------------------
-- 1. Créez le compte Auth : Authentication → Users → Add user
--    email: michelndathi@gmail.com  + mot de passe fort
-- 2. Le trigger met role = super_admin automatiquement pour cet email.
-- 3. Sinon : update public.profiles set role = 'super_admin'
--            where email = 'michelndathi@gmail.com';
