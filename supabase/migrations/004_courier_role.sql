-- Rôle livreur + lien compte Auth (seul l'admin crée / modifie les infos)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('client', 'admin', 'super_admin', 'courier'));

alter table public.couriers
  add column if not exists user_id uuid references public.profiles (id) on delete set null,
  add column if not exists email text default '',
  add column if not exists created_by text default '';

create unique index if not exists couriers_user_id_uidx
  on public.couriers (user_id)
  where user_id is not null;

create index if not exists couriers_email_idx on public.couriers (email);

-- Colis : livreur assigné
alter table public.shipments
  add column if not exists assigned_courier_user_id uuid references public.profiles (id) on delete set null;

create index if not exists shipments_assigned_courier_idx
  on public.shipments (assigned_courier_user_id);

-- RLS: livreur lit son profil courier, lit colis disponibles / les siens
drop policy if exists "couriers_select_all" on public.couriers;
create policy "couriers_select_all"
  on public.couriers for select
  using (true);

drop policy if exists "couriers_staff_write" on public.couriers;
create policy "couriers_staff_write"
  on public.couriers for all
  using (public.is_staff())
  with check (public.is_staff());

-- Trigger: pas d'auto-inscription en courier
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
  v_role := 'client';
  if v_email = 'michelndathi@gmail.com' then
    v_role := 'super_admin';
  end if;
  -- role courier / admin uniquement via admin (update profiles après création)

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
