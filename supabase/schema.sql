create table if not exists public.stations (
  id bigserial primary key,
  name text not null,
  town text not null default 'Boac',
  latitude double precision not null,
  longitude double precision not null,
  unleaded_price numeric(10,2),
  premium_price numeric(10,2),
  diesel_price numeric(10,2),
  unleaded_status text not null default 'available' check (unleaded_status in ('available', 'no_data', 'out_of_stock')),
  premium_status text not null default 'available' check (premium_status in ('available', 'no_data', 'out_of_stock')),
  diesel_status text not null default 'available' check (diesel_status in ('available', 'no_data', 'out_of_stock')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stations_town on public.stations (town);
create index if not exists idx_stations_coordinates on public.stations (latitude, longitude);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stations_set_updated_at on public.stations;
create trigger stations_set_updated_at
before update on public.stations
for each row execute function public.set_updated_at();

alter table public.stations enable row level security;

drop policy if exists "Public can read stations" on public.stations;
create policy "Public can read stations"
on public.stations
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated admins can insert stations" on public.stations;
create policy "Authenticated admins can insert stations"
on public.stations
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated admins can update stations" on public.stations;
create policy "Authenticated admins can update stations"
on public.stations
for update
to authenticated
using (true)
with check (true);

insert into public.stations (
  name,
  town,
  latitude,
  longitude,
  unleaded_price,
  premium_price,
  diesel_price,
  unleaded_status,
  premium_status,
  diesel_status
)
values
  ('Boac Central Fuel Station', 'Boac', 13.4465, 121.8321, 63.80, 67.40, 60.90, 'available', 'available', 'available'),
  ('Pili Highway Gas Hub', 'Boac', 13.4319, 121.8468, 62.90, 66.90, 61.40, 'available', 'available', 'available'),
  ('Riverside Energy Stop', 'Boac', 13.4528, 121.8194, null, 68.20, 62.10, 'no_data', 'available', 'available'),
  ('Balaring Town Fuel', 'Boac', 13.4423, 121.8550, 64.30, null, 61.80, 'available', 'out_of_stock', 'available'),
  ('Pili Gateway Petro', 'Boac', 13.4371, 121.8402, 63.40, 67.00, null, 'available', 'available', 'no_data')
on conflict do nothing;
