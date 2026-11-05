-- Схема: профили, объекты, задачи, история статусов

create type public.user_role as enum ('manager', 'executor');
create type public.task_status as enum ('new', 'in_progress', 'on_review', 'accepted', 'rework');

-- Служебная схема для функций, которые не должны быть доступны через API
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text not null,
  role       public.user_role not null default 'executor',
  created_at timestamptz not null default now()
);

create table public.objects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  address    text not null check (length(btrim(address)) > 0),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  object_id   uuid not null references public.objects (id) on delete cascade,
  title       text not null check (length(btrim(title)) > 0),
  description text not null default '',
  assignee_id uuid not null references public.profiles (id) on delete restrict,
  status      public.task_status not null default 'new',
  author_id   uuid not null references public.profiles (id) on delete restrict default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index tasks_object_id_idx on public.tasks (object_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);

create table public.task_status_history (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references public.tasks (id) on delete cascade,
  from_status public.task_status,
  to_status   public.task_status not null,
  changed_by  uuid references public.profiles (id) on delete set null,
  changed_at  timestamptz not null default now(),
  comment     text
);

create index task_status_history_task_id_idx on public.task_status_history (task_id, changed_at);

-- ---------------------------------------------------------------------------
-- Профиль создаётся автоматически при создании пользователя.
-- Роль берётся из app_metadata: его может задать только администратор, не сам пользователь.
-- ---------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), coalesce(new.email, '')),
    case when new.raw_app_meta_data ->> 'role' = 'manager' then 'manager'::public.user_role
         else 'executor'::public.user_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Вспомогательные функции
-- ---------------------------------------------------------------------------
create function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'manager'
  );
$$;

create function private.objects_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- created_by/created_at через API не меняются (нет привилегий на колонки),
  -- поэтому на UPDATE их не трогаем: иначе сломается on delete set null.
  if tg_op = 'INSERT' then
    new.created_by := coalesce((select auth.uid()), new.created_by);
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger objects_before_write
  before insert or update on public.objects
  for each row execute function private.objects_before_write();

-- ---------------------------------------------------------------------------
-- Правила задачи на уровне строки
-- ---------------------------------------------------------------------------
create function private.tasks_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Новая задача всегда начинается со статуса «Новая», автор — текущий пользователь
    new.status := 'new';
    new.author_id := coalesce((select auth.uid()), new.author_id);
    new.created_at := now();
  else
    if new.status is distinct from old.status
       and coalesce(current_setting('app.status_change', true), '') <> 'on' then
      raise exception 'Статус меняется только через смену статуса задачи' using errcode = 'PT403';
    end if;
    if old.status = 'accepted' then
      raise exception 'Принятую задачу нельзя изменить' using errcode = 'PT409';
    end if;
    new.author_id := old.author_id;
    new.created_at := old.created_at;
  end if;

  if tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id then
    if not exists (select 1 from public.profiles where id = new.assignee_id and role = 'executor') then
      raise exception 'Исполнителем может быть только пользователь с ролью «Исполнитель»' using errcode = '23514';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function private.tasks_before_write();

-- Запись о создании задачи в историю
create function private.tasks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_status_history (task_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, new.author_id);
  return null;
end;
$$;

create trigger tasks_after_insert
  after insert on public.tasks
  for each row execute function private.tasks_after_insert();

-- ---------------------------------------------------------------------------
-- Матрица переходов: кто может перевести задачу из статуса в статус.
-- Возвращает 'manager', 'assignee' или null (переход запрещён).
-- ---------------------------------------------------------------------------
create function private.transition_actor(p_from public.task_status, p_to public.task_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_from = 'new'         and p_to = 'in_progress' then 'assignee'
    when p_from = 'in_progress' and p_to = 'on_review'   then 'assignee'
    when p_from = 'on_review'   and p_to = 'accepted'    then 'manager'
    when p_from = 'on_review'   and p_to = 'rework'      then 'manager'
    when p_from = 'rework'      and p_to = 'in_progress' then 'assignee'
  end;
$$;

create function private.status_label(p_status public.task_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'new'         then 'Новая'
    when 'in_progress' then 'В работе'
    when 'on_review'   then 'На проверке'
    when 'accepted'    then 'Принята'
    when 'rework'      then 'На доработке'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Единственный способ сменить статус задачи
-- ---------------------------------------------------------------------------
create function public.change_task_status(
  p_task_id uuid,
  p_new_status public.task_status,
  p_comment text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_task    public.tasks;
  v_manager boolean;
  v_actor   text;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_from    public.task_status;
begin
  if v_uid is null then
    raise exception 'Требуется вход в систему' using errcode = 'PT401';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then
    raise exception 'Задача не найдена' using errcode = 'PT404';
  end if;

  v_manager := private.is_manager();

  -- Чужую задачу исполнитель не видит: отвечаем так же, как на несуществующую
  if not v_manager and v_task.assignee_id <> v_uid then
    raise exception 'Задача не найдена' using errcode = 'PT404';
  end if;

  v_actor := private.transition_actor(v_task.status, p_new_status);
  if v_actor is null
     or (v_actor = 'manager' and not v_manager)
     or (v_actor = 'assignee' and v_task.assignee_id <> v_uid) then
    raise exception 'Переход из статуса «%» в «%» недоступен',
      private.status_label(v_task.status), private.status_label(p_new_status)
      using errcode = 'PT403';
  end if;

  if p_new_status = 'rework' and v_comment is null then
    raise exception 'При возврате на доработку нужен комментарий' using errcode = 'PT400';
  end if;

  v_from := v_task.status;

  perform set_config('app.status_change', 'on', true);
  update public.tasks set status = p_new_status where id = p_task_id
  returning * into v_task;
  perform set_config('app.status_change', 'off', true);

  insert into public.task_status_history (task_id, from_status, to_status, changed_by, comment)
  values (p_task_id, v_from, p_new_status, v_uid, v_comment);

  return v_task;
end;
$$;

-- ---------------------------------------------------------------------------
-- Права. По умолчанию Supabase выдаёт anon/authenticated всё — забираем и выдаём точечно.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.objects, public.tasks, public.task_status_history from anon, authenticated;

grant select on public.profiles to authenticated;
grant select, delete on public.objects to authenticated;
grant insert (id, name, address) on public.objects to authenticated;
grant update (name, address) on public.objects to authenticated;
grant select, delete on public.tasks to authenticated;
-- Статус, автор и даты задаёт только база
grant insert (id, object_id, title, description, assignee_id) on public.tasks to authenticated;
grant update (object_id, title, description, assignee_id) on public.tasks to authenticated;
-- Историю пишут только функции базы
grant select on public.task_status_history to authenticated;

revoke all on function public.change_task_status(uuid, public.task_status, text) from public, anon;
grant execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;

grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_manager() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

-- Профили: свой, все — постановщику, постановщики — всем (авторы задач и записей истории)
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or role = 'manager' or (select private.is_manager()));

-- Объекты
create policy objects_select on public.objects
  for select to authenticated
  using (
    (select private.is_manager())
    or exists (
      select 1 from public.tasks t
      where t.object_id = objects.id and t.assignee_id = (select auth.uid())
    )
  );

create policy objects_insert on public.objects
  for insert to authenticated
  with check ((select private.is_manager()));

create policy objects_update on public.objects
  for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy objects_delete on public.objects
  for delete to authenticated
  using ((select private.is_manager()));

-- Задачи
create policy tasks_select on public.tasks
  for select to authenticated
  using ((select private.is_manager()) or assignee_id = (select auth.uid()));

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check ((select private.is_manager()));

create policy tasks_update on public.tasks
  for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy tasks_delete on public.tasks
  for delete to authenticated
  using ((select private.is_manager()));

-- История: видна тем, кто видит задачу. Политик на запись нет.
create policy task_status_history_select on public.task_status_history
  for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_status_history.task_id));
