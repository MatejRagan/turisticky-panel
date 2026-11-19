-- =============================================================================
-- Rozhodovací panel pred túrou - Supabase Schema (MVP)
-- =============================================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- =============================================================================
-- 1. TABLES
-- =============================================================================

-- Core catalog of Slovak peaks
create table if not exists public.peaks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  mountain_range text not null,
  peak_elevation_m integer not null check (peak_elevation_m > 0),
  valley_elevation_m integer not null check (valley_elevation_m >= 0 and valley_elevation_m < peak_elevation_m),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  starting_point_name text not null,
  ascent_minutes integer not null check (ascent_minutes > 0),
  descent_minutes integer not null check (descent_minutes > 0),
  distance_km numeric(5, 2) not null check (distance_km > 0),
  -- Format 'MM-DD' (e.g., '11-01' to '06-14') for recurring annual closures
  seasonal_closure_start text check (seasonal_closure_start ~ '^\d{2}-\d{2}$'),
  seasonal_closure_end text check (seasonal_closure_end ~ '^\d{2}-\d{2}$'),
  seasonal_closure_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unified daily weather snapshots synced by background worker
create table if not exists public.weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  peak_id uuid not null references public.peaks(id) on delete cascade,
  forecast_date date not null,
  fetched_at timestamptz not null default now(),
  temp_peak_min_c numeric(4, 1),
  temp_peak_max_c numeric(4, 1),
  temp_valley_min_c numeric(4, 1),
  temp_valley_max_c numeric(4, 1),
  wind_speed_max_kmh numeric(5, 1),
  wind_gust_max_kmh numeric(5, 1),
  precipitation_mm numeric(5, 1),
  snowfall_cm numeric(5, 1),
  cloud_cover_pct integer check (cloud_cover_pct between 0 and 100),
  -- 0-100 score representing agreement across weather models (ICON, ECMWF, GFS)
  model_agreement_index integer check (model_agreement_index between 0 and 100),
  source_models text[] not null default '{}',
  raw_payload jsonb,
  unique (peak_id, forecast_date)
);

-- Community / archive terrain photo reports
create table if not exists public.photo_reports (
  id uuid primary key default gen_random_uuid(),
  peak_id uuid not null references public.peaks(id) on delete cascade,
  image_path text not null check (char_length(trim(image_path)) > 0),
  image_url text not null check (char_length(trim(image_url)) > 0),
  taken_at date not null,
  elevation_approx_m integer check (elevation_approx_m > 0),
  surface_condition text not null check (
    surface_condition in ('dry', 'mud', 'snow_patches', 'continuous_snow', 'ice', 'mixed')
  ),
  recommended_gear text[] not null default '{}',
  note text,
  author_name text not null default 'Anonym',
  is_approved boolean not null default true,
  created_at timestamptz not null default now()
);

-- External live webcams linked to peaks
create table if not exists public.webcams (
  id uuid primary key default gen_random_uuid(),
  peak_id uuid not null references public.peaks(id) on delete cascade,
  name text not null,
  provider text not null,
  stream_url text not null,
  thumbnail_url text,
  elevation_m integer check (elevation_m > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- 2. INDEXES
-- =============================================================================

create index if not exists idx_peaks_mountain_range
  on public.peaks (mountain_range);

create index if not exists idx_weather_snapshots_peak_date
  on public.weather_snapshots (peak_id, forecast_date);

create index if not exists idx_photo_reports_peak_taken_at
  on public.photo_reports (peak_id, taken_at desc);

create index if not exists idx_photo_reports_approved
  on public.photo_reports (peak_id, is_approved)
  where is_approved = true;

create index if not exists idx_webcams_peak_active
  on public.webcams (peak_id)
  where is_active = true;

-- =============================================================================
-- 3. UPDATED_AT TRIGGER FOR PEAKS
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_peaks_set_updated_at on public.peaks;
create trigger trg_peaks_set_updated_at
  before update on public.peaks
  for each row
  execute function public.set_updated_at();

-- =============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =============================================================================

alter table public.peaks enable row level security;
alter table public.weather_snapshots enable row level security;
alter table public.photo_reports enable row level security;
alter table public.webcams enable row level security;

-- peaks: public read-only (writes strictly via service_role)
drop policy if exists "Public can read peaks" on public.peaks;
create policy "Public can read peaks"
  on public.peaks
  for select
  to anon, authenticated
  using (true);

-- weather_snapshots: public read-only (writes strictly via service_role)
drop policy if exists "Public can read weather snapshots" on public.weather_snapshots;
create policy "Public can read weather snapshots"
  on public.weather_snapshots
  for select
  to anon, authenticated
  using (true);

-- webcams: public can read active webcams only (writes strictly via service_role)
drop policy if exists "Public can read active webcams" on public.webcams;
create policy "Public can read active webcams"
  on public.webcams
  for select
  to anon, authenticated
  using (is_active = true);

-- photo_reports: public can read approved reports and submit new ones
drop policy if exists "Public can read approved photo reports" on public.photo_reports;
create policy "Public can read approved photo reports"
  on public.photo_reports
  for select
  to anon, authenticated
  using (is_approved = true);

drop policy if exists "Public can insert photo reports" on public.photo_reports;
create policy "Public can insert photo reports"
  on public.photo_reports
  for insert
  to anon, authenticated
  with check (is_approved = true);

-- =============================================================================
-- 5. STORAGE BUCKET & STORAGE RLS POLICIES (terrain-photos)
-- =============================================================================

-- 2 MB limit = 2 * 1024 * 1024 = 2097152 bytes, strictly WebP and JPEG
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'terrain-photos',
  'terrain-photos',
  true,
  2097152,
  array['image/webp', 'image/jpeg']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read access to terrain-photos bucket
drop policy if exists "Public can view terrain photos" on storage.objects;
create policy "Public can view terrain photos"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'terrain-photos');

-- Public upload access to terrain-photos bucket (no overwrite/delete for anon)
drop policy if exists "Public can upload terrain photos" on storage.objects;
create policy "Public can upload terrain photos"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'terrain-photos');
