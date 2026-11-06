-- Studyroom cloud schema. User-owned rows use client IDs scoped by user_id.
-- `deleted_at` is a tombstone: clients upsert it and must not physically delete rows.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '' check (char_length(email) <= 254),
  first_name text not null default '' check (char_length(first_name) <= 60),
  last_name text not null default '' check (char_length(last_name) <= 60),
  photo_url text,
  settings jsonb not null default '{"theme":"midnight","dark":false}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  streak integer not null default 0 check (streak >= 0),
  last_study date,
  role text not null default 'user' check (role in ('user', 'admin')),
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Create an ordinary profile at signup. Role and disabled always start at safe values.
create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, role, disabled)
  values (new.id, coalesce(new.email, ''), 'user', false)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

create table public.subjects (
  id text not null check (char_length(id) between 1 and 128),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) <= 200),
  topics jsonb not null default '[]'::jsonb check (jsonb_typeof(topics) = 'array'),
  topic_aliases jsonb not null default '[]'::jsonb check (jsonb_typeof(topic_aliases) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table public.questions (
  id text not null check (char_length(id) between 1 and 128),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_id text,
  topic text not null default '' check (char_length(topic) <= 300),
  question_type text not null check (question_type in ('mcq', 'tf')),
  text text not null check (char_length(text) <= 20000),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  correct jsonb,
  explanation text not null default '' check (char_length(explanation) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id),
  foreign key (user_id, subject_id) references public.subjects (user_id, id)
    on update cascade deferrable initially deferred
);

create table public.cards (
  id text not null check (char_length(id) between 1 and 128),
  user_id uuid not null references auth.users (id) on delete cascade,
  front text not null check (char_length(front) <= 20000),
  back text not null check (char_length(back) <= 20000),
  subject_id text,
  topic text not null default '' check (char_length(topic) <= 300),
  source_question_id text,
  due date,
  interval integer not null default 0 check (interval >= 0),
  last_rating text check (last_rating is null or last_rating in ('again', 'hard', 'good', 'easy')),
  generated_for_revision boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id),
  foreign key (user_id, subject_id) references public.subjects (user_id, id)
    on update cascade deferrable initially deferred,
  foreign key (user_id, source_question_id) references public.questions (user_id, id)
    on update cascade deferrable initially deferred
);

create table public.exams (
  id text not null check (char_length(id) between 1 and 128),
  user_id uuid not null references auth.users (id) on delete cascade,
  definition jsonb not null default '{}'::jsonb check (jsonb_typeof(definition) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id)
);

create table public.attempts (
  id text not null check (char_length(id) between 1 and 128),
  user_id uuid not null references auth.users (id) on delete cascade,
  exam_id text,
  name text not null default '' check (char_length(name) <= 300),
  subject_id text,
  topic_name text not null default '' check (char_length(topic_name) <= 300),
  scope text not null default '' check (char_length(scope) <= 100),
  topic_counts jsonb not null default '{}'::jsonb check (jsonb_typeof(topic_counts) = 'object'),
  questions jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  marked jsonb not null default '[]'::jsonb check (jsonb_typeof(marked) = 'array'),
  started_at timestamptz,
  minutes integer check (minutes is null or minutes between 0 and 1440),
  pass integer check (pass is null or pass between 0 and 100),
  instructions text not null default '' check (char_length(instructions) <= 10000),
  submitted_at timestamptz,
  score integer check (score is null or score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id),
  foreign key (user_id, exam_id) references public.exams (user_id, id)
    on update cascade deferrable initially deferred,
  foreign key (user_id, subject_id) references public.subjects (user_id, id)
    on update cascade deferrable initially deferred
);

create table public.question_reviews (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id text not null check (char_length(question_id) between 1 and 128),
  wrong integer not null default 0 check (wrong >= 0),
  correct integer not null default 0 check (correct >= 0),
  mastered boolean not null default false,
  dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, question_id),
  foreign key (user_id, question_id) references public.questions (user_id, id)
    on update cascade deferrable initially deferred
);

create table public.import_hashes (
  id text not null check (char_length(id) between 1 and 256),
  user_id uuid not null references auth.users (id) on delete cascade,
  hash text not null check (char_length(hash) between 1 and 256),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, id),
  unique (user_id, hash)
);

-- Append-only event stream for audit and cross-user admin aggregates. It is
-- server/API generated, not synced from the capped local activity[] cache.
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  -- Retain the actor ID if the corresponding Auth account is later removed.
  user_id uuid not null,
  event_type text not null check (char_length(event_type) between 1 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  resource_type text check (resource_type is null or char_length(resource_type) <= 100),
  resource_id text check (resource_id is null or char_length(resource_id) <= 256),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index subjects_user_updated_idx on public.subjects (user_id, updated_at desc);
create index questions_user_updated_idx on public.questions (user_id, updated_at desc);
create index cards_user_updated_idx on public.cards (user_id, updated_at desc);
create index exams_user_updated_idx on public.exams (user_id, updated_at desc);
create index attempts_user_updated_idx on public.attempts (user_id, updated_at desc);
create index attempts_submitted_at_idx on public.attempts (submitted_at) where deleted_at is null;
create index reviews_user_updated_idx on public.question_reviews (user_id, updated_at desc);
create index import_hashes_user_updated_idx on public.import_hashes (user_id, updated_at desc);
create index activity_log_created_at_idx on public.activity_log (created_at desc);
create index activity_log_user_created_at_idx on public.activity_log (user_id, created_at desc);

create trigger profiles_set_updated_at before insert or update on public.profiles
  for each row execute function public.set_updated_at();
create trigger subjects_set_updated_at before insert or update on public.subjects
  for each row execute function public.set_updated_at();
create trigger questions_set_updated_at before insert or update on public.questions
  for each row execute function public.set_updated_at();
create trigger cards_set_updated_at before insert or update on public.cards
  for each row execute function public.set_updated_at();
create trigger exams_set_updated_at before insert or update on public.exams
  for each row execute function public.set_updated_at();
create trigger attempts_set_updated_at before insert or update on public.attempts
  for each row execute function public.set_updated_at();
create trigger question_reviews_set_updated_at before insert or update on public.question_reviews
  for each row execute function public.set_updated_at();
create trigger import_hashes_set_updated_at before insert or update on public.import_hashes
  for each row execute function public.set_updated_at();

create or replace function public.reject_activity_log_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'activity_log is append-only';
end;
$$;
create trigger activity_log_append_only
  before update or delete on public.activity_log
  for each row execute function public.reject_activity_log_mutation();

-- RLS helper avoids repeating profile lookups in every policy. The function
-- only returns the active-account boolean for the authenticated principal.
create or replace function public.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.disabled = false and p.deleted_at is null
  );
$$;
revoke all on function public.is_active_account() from public, anon;
grant execute on function public.is_active_account() to authenticated;

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.questions enable row level security;
alter table public.cards enable row level security;
alter table public.exams enable row level security;
alter table public.attempts enable row level security;
alter table public.question_reviews enable row level security;
alter table public.import_hashes enable row level security;
alter table public.activity_log enable row level security;

create policy profiles_read_self on public.profiles for select to authenticated
  using (user_id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated
  using (user_id = auth.uid() and disabled = false and deleted_at is null)
  with check (user_id = auth.uid() and disabled = false and deleted_at is null);

create policy subjects_self on public.subjects for all to authenticated
  using (user_id = auth.uid() and public.is_active_account())
  with check (user_id = auth.uid() and public.is_active_account());
create policy questions_self on public.questions for all to authenticated
  using (user_id = auth.uid() and public.is_active_account())
  with check (user_id = auth.uid() and public.is_active_account());
create policy cards_self on public.cards for all to authenticated
  using (user_id = auth.uid() and public.is_active_account())
  with check (user_id = auth.uid() and public.is_active_account());
create policy exams_self on public.exams for all to authenticated
  using (user_id = auth.uid() and public.is_active_account())
  with check (user_id = auth.uid() and public.is_active_account());
create policy attempts_self on public.attempts for all to authenticated
  using (user_id = auth.uid() and public.is_active_account())
  with check (user_id = auth.uid() and public.is_active_account());
create policy question_reviews_self on public.question_reviews for all to authenticated
  using (user_id = auth.uid() and public.is_active_account())
  with check (user_id = auth.uid() and public.is_active_account());
create policy import_hashes_self on public.import_hashes for all to authenticated
  using (user_id = auth.uid() and public.is_active_account())
  with check (user_id = auth.uid() and public.is_active_account());
create policy activity_log_insert_self on public.activity_log for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_account());

-- Do not expose role, disabled, identity, ownership, or server timestamps as
-- user-writable columns. The service role is reserved for admin/API work.
revoke all on public.profiles, public.subjects, public.questions, public.cards,
  public.exams, public.attempts, public.question_reviews, public.import_hashes,
  public.activity_log from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (email, first_name, last_name, photo_url, settings, streak, last_study, deleted_at)
  on public.profiles to authenticated;

grant select on public.subjects to authenticated;
grant insert (id, user_id, name, topics, topic_aliases, deleted_at) on public.subjects to authenticated;
grant update (name, topics, topic_aliases, deleted_at) on public.subjects to authenticated;
grant select on public.questions to authenticated;
grant insert (id, user_id, subject_id, topic, question_type, text, options, correct, explanation, deleted_at)
  on public.questions to authenticated;
grant update (subject_id, topic, question_type, text, options, correct, explanation, deleted_at)
  on public.questions to authenticated;
grant select on public.cards to authenticated;
grant insert (id, user_id, front, back, subject_id, topic, source_question_id, due, interval, last_rating, generated_for_revision, deleted_at)
  on public.cards to authenticated;
grant update (front, back, subject_id, topic, source_question_id, due, interval, last_rating, generated_for_revision, deleted_at)
  on public.cards to authenticated;
grant select on public.exams to authenticated;
grant insert (id, user_id, definition, deleted_at) on public.exams to authenticated;
grant update (definition, deleted_at) on public.exams to authenticated;
grant select on public.attempts to authenticated;
grant insert (id, user_id, exam_id, name, subject_id, topic_name, scope, topic_counts, questions, answers, marked, started_at, minutes, pass, instructions, submitted_at, score, deleted_at)
  on public.attempts to authenticated;
grant update (exam_id, name, subject_id, topic_name, scope, topic_counts, questions, answers, marked, started_at, minutes, pass, instructions, submitted_at, score, deleted_at)
  on public.attempts to authenticated;
grant select on public.question_reviews to authenticated;
grant insert (user_id, question_id, wrong, correct, mastered, dismissed, deleted_at)
  on public.question_reviews to authenticated;
grant update (wrong, correct, mastered, dismissed, deleted_at)
  on public.question_reviews to authenticated;
grant select on public.import_hashes to authenticated;
grant insert (id, user_id, hash, deleted_at) on public.import_hashes to authenticated;
grant update (hash, deleted_at) on public.import_hashes to authenticated;
grant insert (user_id, event_type, description, resource_type, resource_id, metadata)
  on public.activity_log to authenticated;

-- Server-side routes may read and modify user data after authenticating the
-- caller. Browser code must never receive SUPABASE_SERVICE_ROLE_KEY.
grant select, insert, update on public.profiles, public.subjects,
  public.questions, public.cards, public.exams, public.attempts,
  public.question_reviews, public.import_hashes to service_role;
grant select, insert on public.activity_log to service_role;
