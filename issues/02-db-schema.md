# 02. Схема БД: профили, роли, объекты, задачи, история

**Метка:** `db`  
**Статус:** выполнен

Миграция с базовой схемой.

- [x] enum `user_role`: `manager` (постановщик), `executor` (исполнитель)
- [x] enum `task_status`: `new`, `in_progress`, `on_review`, `accepted`, `rework`
- [x] `profiles` (id = auth.users.id, full_name, email, role)
- [x] `objects` (id, name, address, created_at, created_by)
- [x] `tasks` (id, object_id, title, description, assignee_id, status, author_id, created_at, updated_at)
- [x] `task_status_history` (id, task_id, from_status, to_status, changed_by, changed_at, comment)
- [x] Внешние ключи, поведение `on delete` для задач объекта и истории задачи, индексы по `object_id`, `assignee_id`, `task_id`
- [x] `author_id`, `created_at` проставляются базой (`auth.uid()` / `now()`), а не клиентом

**Готово, когда:** `supabase db reset` поднимает схему с нуля.
