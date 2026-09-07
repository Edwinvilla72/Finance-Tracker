-- 0003: user feedback (feature requests and bug reports) with an admin workflow.
-- Safe to run more than once.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  feedback_type text not null default 'feature'
    check (feedback_type in ('feature', 'bug', 'other')),
  title text not null
    check (char_length(btrim(title)) between 3 and 120),
  description text not null
    check (char_length(btrim(description)) between 10 and 4000),
  additional_details text
    check (additional_details is null or char_length(additional_details) <= 4000),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'wont_fix')),
  admin_notes text
    check (admin_notes is null or char_length(admin_notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

comment on table public.feedback is 'Feature requests and bug reports submitted from the app. Users see their own rows; admins see and triage everything.';
comment on column public.feedback.status is 'open -> in_progress -> resolved | wont_fix. Only admins can change it.';
comment on column public.feedback.admin_notes is 'Optional reply from the admin, visible to the submitter.';

create index if not exists feedback_status_created_idx
  on public.feedback (status, created_at desc);
create index if not exists feedback_user_created_idx
  on public.feedback (user_id, created_at desc);

-- Stamp updated_at and keep resolved_at in step with the status.
create or replace function public.handle_feedback_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();

  if new.status in ('resolved', 'wont_fix') then
    if old.status is distinct from new.status or new.resolved_at is null then
      new.resolved_at = now();
    end if;
  else
    new.resolved_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists feedback_before_update on public.feedback;
create trigger feedback_before_update
  before update on public.feedback
  for each row execute function public.handle_feedback_update();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.feedback enable row level security;

drop policy if exists "Users can view own feedback" on public.feedback;
create policy "Users can view own feedback" on public.feedback
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Admins can view all feedback" on public.feedback;
create policy "Admins can view all feedback" on public.feedback
  for select to authenticated
  using (public.is_admin());

-- New feedback always starts open, with no admin fields filled in.
drop policy if exists "Users can submit feedback" on public.feedback;
create policy "Users can submit feedback" on public.feedback
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'open'
    and admin_notes is null
    and resolved_at is null
  );

drop policy if exists "Admins can update feedback" on public.feedback;
create policy "Admins can update feedback" on public.feedback
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete feedback" on public.feedback;
create policy "Admins can delete feedback" on public.feedback
  for delete to authenticated
  using (public.is_admin());

revoke all on table public.feedback from anon;
grant select, insert, update, delete on table public.feedback to authenticated;

notify pgrst, 'reload schema';
