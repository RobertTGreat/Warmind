-- Create a table to store cached Bungie profiles/stats to avoid rate limits and enable leaderboards
create table if not exists public.destiny_profiles (
  membership_id text primary key,
  membership_type int not null,
  display_name text,
  last_updated timestamp with time zone default timezone('utc'::text, now()),
  data jsonb -- Store the full stats object here for flexibility
);

-- Create a table for specific activity history if we want to track individual runs (optional but good for "Reports")
create table if not exists public.activity_history (
  instance_id text primary key,
  membership_id text references public.destiny_profiles(membership_id),
  activity_hash bigint not null,
  date_completed timestamp with time zone,
  duration_seconds int,
  completed boolean,
  flawless boolean,
  solo boolean,
  pgcr_image text
);

-- Indexes
create index if not exists idx_destiny_profiles_display_name on public.destiny_profiles(display_name);
create index if not exists idx_activity_history_membership_id on public.activity_history(membership_id);
create index if not exists idx_activity_history_activity_hash on public.activity_history(activity_hash);

-- Row Level Security (RLS)
-- Enable RLS
alter table public.destiny_profiles enable row level security;
alter table public.activity_history enable row level security;

-- Policies (Public Read, Authenticated Write - simplified for this use case)
-- Allow anyone to read profiles (like raid.report)
create policy "Public profiles are viewable by everyone"
  on public.destiny_profiles for select
  using ( true );

create policy "Public activity history is viewable by everyone"
  on public.activity_history for select
  using ( true );

-- Allow authenticated users (service role or logged in) to insert/update
-- Assuming the app uses a service key for updates or specific user logic
create policy "Users can insert their own profile"
  on public.destiny_profiles for insert
  with check ( true ); -- Adjust based on auth needs

create policy "Users can update their own profile"
  on public.destiny_profiles for update
  using ( true ); -- Adjust based on auth needs

