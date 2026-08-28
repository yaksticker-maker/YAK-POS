create table if not exists public.yak_store_state(store_id text primary key,state jsonb not null default '{}'::jsonb,updated_at timestamptz not null default now(),updated_by text);
alter table public.yak_store_state enable row level security;
drop policy if exists "yak bootstrap read" on public.yak_store_state;drop policy if exists "yak bootstrap insert" on public.yak_store_state;drop policy if exists "yak bootstrap update" on public.yak_store_state;
create policy "yak bootstrap read" on public.yak_store_state for select to anon,authenticated using(store_id='yak-main');
create policy "yak bootstrap insert" on public.yak_store_state for insert to anon,authenticated with check(store_id='yak-main');
create policy "yak bootstrap update" on public.yak_store_state for update to anon,authenticated using(store_id='yak-main') with check(store_id='yak-main');
grant select,insert,update on public.yak_store_state to anon,authenticated;
do $$ begin alter publication supabase_realtime add table public.yak_store_state;exception when duplicate_object then null;end $$;