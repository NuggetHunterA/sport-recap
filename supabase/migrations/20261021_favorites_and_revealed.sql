-- Lieblingsteams und aufgedeckte Spiele pro Benutzer (so im Projekt sport-recap angelegt)
create table public.favorites (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  league text not null,
  match text not null,
  label text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, league, match)
);

create table public.revealed (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  game_id text not null,
  revealed_at timestamptz not null default now(),
  primary key (user_id, game_id)
);
create index revealed_user_time on public.revealed (user_id, revealed_at desc);

alter table public.favorites enable row level security;
alter table public.revealed enable row level security;

create policy "eigene Favoriten" on public.favorites for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "eigene aufgedeckte Spiele" on public.revealed for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.favorites, public.revealed from anon;
grant select, insert, update, delete on public.favorites, public.revealed to authenticated;
