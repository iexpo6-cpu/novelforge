-- NovelForge Supabase Database Schema & RLS Policies
-- Run this SQL in your Supabase SQL Editor.

create extension if not exists "pgcrypto";

-- 1. Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  genre text not null default '판타지',
  logline text not null default '',
  synopsis text not null default '',
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Chapters
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  order_index integer not null default 0,
  title text not null default '1화. 제목 없음',
  content text not null default '',
  summary text not null default '',
  word_count integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'writing', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Characters
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  folder text not null default '미분류',
  name text not null,
  role text not null default '조연',
  age text not null default '',
  appearance text not null default '',
  personality text not null default '',
  background text not null default '',
  relationships text not null default '',
  custom_fields jsonb not null default '[]'::jsonb,
  avatar_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. World Settings
create table if not exists public.world_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  folder text not null default '미분류',
  category text not null default '장소',
  title text not null,
  description text not null default '',
  tags text[] not null default '{}',
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Plot Nodes
create table if not exists public.plot_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  folder text not null default '미분류',
  order_index integer not null default 0,
  act_label text not null default '기',
  title text not null,
  description text not null default '',
  chapter_id uuid references public.chapters(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Project Images
create table if not exists public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  target_type text not null check (target_type in ('cover', 'character', 'world', 'scene')),
  target_id uuid,
  prompt text not null,
  image_url text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- 7. AI Chat Messages
create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  action_type text not null default 'chat',
  created_at timestamptz not null default now()
);

-- Auto-update updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

drop trigger if exists set_chapters_updated_at on public.chapters;
create trigger set_chapters_updated_at
  before update on public.chapters
  for each row execute function public.handle_updated_at();

drop trigger if exists set_characters_updated_at on public.characters;
create trigger set_characters_updated_at
  before update on public.characters
  for each row execute function public.handle_updated_at();

drop trigger if exists set_world_settings_updated_at on public.world_settings;
create trigger set_world_settings_updated_at
  before update on public.world_settings
  for each row execute function public.handle_updated_at();

drop trigger if exists set_plot_nodes_updated_at on public.plot_nodes;
create trigger set_plot_nodes_updated_at
  before update on public.plot_nodes
  for each row execute function public.handle_updated_at();

-- Enable RLS
alter table public.projects enable row level security;
alter table public.chapters enable row level security;
alter table public.characters enable row level security;
alter table public.world_settings enable row level security;
alter table public.plot_nodes enable row level security;
alter table public.project_images enable row level security;
alter table public.ai_chat_messages enable row level security;

-- RLS Policies: Users can only access their own projects and child records
create policy "Users manage own projects"
  on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage chapters of own projects"
  on public.chapters for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "Users manage characters of own projects"
  on public.characters for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "Users manage world_settings of own projects"
  on public.world_settings for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "Users manage plot_nodes of own projects"
  on public.plot_nodes for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "Users manage project_images of own projects"
  on public.project_images for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "Users manage ai_chat_messages of own projects"
  on public.ai_chat_messages for all
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

-- Storage Bucket for novel images
insert into storage.buckets (id, name, public)
values ('novel-images', 'novel-images', true)
on conflict (id) do nothing;

create policy "Public read access for novel-images"
  on storage.objects for select
  using (bucket_id = 'novel-images');

create policy "Authenticated users upload to own folder in novel-images"
  on storage.objects for insert
  with check (
    bucket_id = 'novel-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Authenticated users delete own images in novel-images"
  on storage.objects for delete
  using (
    bucket_id = 'novel-images'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Grant table & sequence permissions to Supabase API roles (RLS still enforces per-user isolation)
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

