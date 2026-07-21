create table if not exists public.hmc_scores (
  uid text primary key,
  score bigint not null,
  updated_at timestamptz not null default now()
);

create index if not exists hmc_scores_score_desc_idx
  on public.hmc_scores (score desc);

alter table public.hmc_scores enable row level security;

drop policy if exists "anon can read scores" on public.hmc_scores;
create policy "anon can read scores"
  on public.hmc_scores for select
  to anon
  using (true);

drop policy if exists "anon can insert scores" on public.hmc_scores;
create policy "anon can insert scores"
  on public.hmc_scores for insert
  to anon
  with check (true);

drop policy if exists "anon can update scores" on public.hmc_scores;
create policy "anon can update scores"
  on public.hmc_scores for update
  to anon
  using (true)
  with check (true);

create or replace function public.prune_hmc_scores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.hmc_scores
  where uid in (
    select uid
    from public.hmc_scores
    order by score desc, updated_at desc
    offset 1000
  );
  return null;
end;
$$;

drop trigger if exists hmc_scores_keep_top_1000 on public.hmc_scores;
create trigger hmc_scores_keep_top_1000
after insert or update on public.hmc_scores
for each statement execute function public.prune_hmc_scores();
