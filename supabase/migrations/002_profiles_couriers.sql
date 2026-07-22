-- =============================================================================
-- LivrExpress — Profils enrichis + livreurs (mapping client / transparence)
-- SQL Editor → Run après 001_init_livrexpress.sql
-- =============================================================================

-- Colonnes profil client
alter table public.profiles
  add column if not exists photo_url text default '',
  add column if not exists city text default 'Dakar',
  add column if not exists neighborhood text default '',
  add column if not exists company text default '',
  add column if not exists bio text default '',
  add column if not exists preferred_pickup text default '',
  add column if not exists preferred_dropoff text default '',
  add column if not exists default_plan text default 'Express',
  add column if not exists client_tier text default 'standard'
    check (client_tier in ('standard', 'pro', 'business', 'vip')),
  add column if not exists tags text[] default '{}',
  add column if not exists last_order_at timestamptz,
  add column if not exists total_orders int default 0,
  add column if not exists total_spent int default 0;

create index if not exists profiles_city_idx on public.profiles (city);
create index if not exists profiles_tier_idx on public.profiles (client_tier);
create index if not exists profiles_neighborhood_idx on public.profiles (neighborhood);

-- -----------------------------------------------------------------------------
-- COURIERS (profils livreurs publics)
-- -----------------------------------------------------------------------------
create table if not exists public.couriers (
  id text primary key,
  name text not null,
  phone text not null default '',
  photo_url text default '',
  avatar text default '🛵',
  vehicle text default 'Moto',
  plate text default '',
  zone text default 'Dakar',
  rating numeric(2,1) default 4.8,
  deliveries_count int default 0,
  bio text default '',
  languages text[] default array['Français','Wolof'],
  verified boolean default true,
  active boolean default true,
  joined_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists couriers_active_idx on public.couriers (active);
create index if not exists couriers_zone_idx on public.couriers (zone);

drop trigger if exists couriers_updated_at on public.couriers;
create trigger couriers_updated_at
  before update on public.couriers
  for each row execute function public.set_updated_at();

alter table public.couriers enable row level security;

drop policy if exists "couriers_select_all" on public.couriers;
create policy "couriers_select_all"
  on public.couriers for select
  using (true);

drop policy if exists "couriers_staff_write" on public.couriers;
create policy "couriers_staff_write"
  on public.couriers for all
  using (public.is_staff())
  with check (public.is_staff());

-- Seed livreurs démo (idempotent)
insert into public.couriers (id, name, phone, avatar, vehicle, plate, zone, rating, deliveries_count, bio, languages, verified)
values
  ('cr_moussa', 'Moussa Diop', '221770000001', '🛵', 'Moto', 'DK-4521-A', 'Plateau · Médina · Point E', 4.9, 842,
   'Livreur LivrExpress depuis 2022. Ponctuel, soigneux avec les documents et colis fragiles.',
   array['Français','Wolof'], true),
  ('cr_awa', 'Awa Sarr', '221770000002', '🛵', 'Moto', 'DK-8830-B', 'Almadies · Ouakam · Ngor', 4.8, 691,
   'Spécialiste zone Ouest. Disponible 7j/7 pour courses Express et Pro.',
   array['Français','Wolof','English'], true),
  ('cr_ibrahima', 'Ibrahima Fall', '221770000003', '🛵', 'Moto', 'DK-1204-C', 'Parcelles · Pikine · Guédiawaye', 4.7, 520,
   'Connaît parfaitement le trafic périphérie. Remises en main propre sécurisées.',
   array['Français','Wolof'], true),
  ('cr_fatou', 'Fatou Kane', '221770000004', '🛵', 'Scooter', 'DK-3399-D', 'Mermoz · Sacré-Cœur · Fann', 5.0, 410,
   'Top livreuse 2025. Communication client exemplaire et suivi GPS rigoureux.',
   array['Français','Wolof'], true)
on conflict (id) do nothing;

-- Lien optionnel shipment → courier id
alter table public.shipments
  add column if not exists courier_id text references public.couriers (id) on delete set null;
