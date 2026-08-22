-- Agent runs persistence
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'chat' check (mode in ('chat','agent')),
  speed text not null default 'balanced' check (speed in ('fast','balanced','deep')),
  model text,
  prompt text,
  status text not null default 'running' check (status in ('running','done','error','cancelled')),
  loop_count integer not null default 0,
  summary text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists agent_runs_project_idx on public.agent_runs(project_id, started_at desc);
alter table public.agent_runs enable row level security;
create policy "Users read own agent runs" on public.agent_runs for select using (auth.uid() = user_id);
create policy "Users insert own agent runs" on public.agent_runs for insert with check (auth.uid() = user_id);
create policy "Users update own agent runs" on public.agent_runs for update using (auth.uid() = user_id);

create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  file_path text,
  status text not null default 'running' check (status in ('running','done','error')),
  input_preview text,
  output_preview text,
  created_at timestamptz not null default now()
);
create index if not exists agent_actions_run_idx on public.agent_actions(run_id, created_at);
alter table public.agent_actions enable row level security;
create policy "Users read own agent actions" on public.agent_actions for select using (auth.uid() = user_id);
create policy "Users insert own agent actions" on public.agent_actions for insert with check (auth.uid() = user_id);
create policy "Users update own agent actions" on public.agent_actions for update using (auth.uid() = user_id);

create table if not exists public.agent_patches (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_path text not null,
  before_hash text,
  after_hash text,
  diff text,
  accepted boolean,
  created_at timestamptz not null default now()
);
create index if not exists agent_patches_run_idx on public.agent_patches(run_id, created_at);
alter table public.agent_patches enable row level security;
create policy "Users read own agent patches" on public.agent_patches for select using (auth.uid() = user_id);
create policy "Users insert own agent patches" on public.agent_patches for insert with check (auth.uid() = user_id);
create policy "Users update own agent patches" on public.agent_patches for update using (auth.uid() = user_id);

create table if not exists public.build_attempts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  phase text not null,
  github_run_id bigint,
  status text not null default 'pending',
  failed_step text,
  log_excerpt text,
  ai_fix_summary text,
  created_at timestamptz not null default now()
);
create index if not exists build_attempts_project_idx on public.build_attempts(project_id, created_at desc);
alter table public.build_attempts enable row level security;
create policy "Users read own build attempts" on public.build_attempts for select using (auth.uid() = user_id);
create policy "Users insert own build attempts" on public.build_attempts for insert with check (auth.uid() = user_id);
create policy "Users update own build attempts" on public.build_attempts for update using (auth.uid() = user_id);
