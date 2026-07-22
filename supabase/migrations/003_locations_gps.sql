-- Positions GPS live (livreur téléphone de service + client)
alter table public.shipments
  add column if not exists locations jsonb default '{}'::jsonb;

comment on column public.shipments.locations is
  'pickup/delivery coords + courier phone GPS + client live GPS';

-- Index GIN optionnel pour requêtes JSON
create index if not exists shipments_locations_gin
  on public.shipments using gin (locations);
