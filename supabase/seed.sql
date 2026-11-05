-- Тестовые данные для локальной разработки (supabase db reset).
-- Пароль у всех тестовых пользователей: Password123!
-- В облачном проекте пользователей создают вручную, см. README.

-- Пользователи --------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', u.role),
  jsonb_build_object('full_name', u.full_name), now(), now(),
  '', '', '', ''
from (values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'manager@crm.local',   'Ирина Петрова (постановщик)', 'manager'),
  ('20000000-0000-0000-0000-000000000001'::uuid, 'executor1@crm.local', 'Алексей Смирнов',             'executor'),
  ('20000000-0000-0000-0000-000000000002'::uuid, 'executor2@crm.local', 'Дмитрий Кузнецов',            'executor')
) as u (id, email, full_name, role);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email like '%@crm.local';

-- Объекты и задачи создаём от имени постановщика, статусы двигаем через change_task_status,
-- чтобы история получилась такой же, как при реальной работе.
create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
$$;

select pg_temp.act_as('10000000-0000-0000-0000-000000000001');

insert into public.objects (id, name, address) values
  ('30000000-0000-0000-0000-000000000001', 'ЖК «Лазурный квартал», корпус 2', 'г. Энск, ул. Первопроходцев, 17'),
  ('30000000-0000-0000-0000-000000000002', 'Коттедж у Тихого озера',       'пос. Нижние Сосенки, ул. Янтарная, 8'),
  ('30000000-0000-0000-0000-000000000003', 'Склад «Энск-Терминал»',       'г. Энск, Промышленный проезд, 3');

insert into public.tasks (id, object_id, title, description, assignee_id) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Залить фундамент секции А', 'Бетон М300, проверить армирование перед заливкой.', '20000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Кладка стен 1 этажа',      'Газобетон D500, толщина 375 мм.',                   '20000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'Монтаж опалубки перекрытия', '',                                                  '20000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'Устройство кровли',          'Металлочерепица, цвет RAL 8017.',                   '20000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', 'Электрика: черновой монтаж', 'По проекту ЭО-01.',                                 '20000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000003', 'Демонтаж старых ворот',      '',                                                  '20000000-0000-0000-0000-000000000002');

-- Задача 1: принята после одного возврата на доработку
select pg_temp.act_as('20000000-0000-0000-0000-000000000001');
select public.change_task_status('40000000-0000-0000-0000-000000000001', 'in_progress');
select public.change_task_status('40000000-0000-0000-0000-000000000001', 'on_review', 'Залито, фото в чате');
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select public.change_task_status('40000000-0000-0000-0000-000000000001', 'rework', 'Нет протокола испытания бетона');
select pg_temp.act_as('20000000-0000-0000-0000-000000000001');
select public.change_task_status('40000000-0000-0000-0000-000000000001', 'in_progress');
select public.change_task_status('40000000-0000-0000-0000-000000000001', 'on_review', 'Протокол приложен');
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select public.change_task_status('40000000-0000-0000-0000-000000000001', 'accepted');

-- Задача 2: на проверке
select pg_temp.act_as('20000000-0000-0000-0000-000000000002');
select public.change_task_status('40000000-0000-0000-0000-000000000002', 'in_progress');
select public.change_task_status('40000000-0000-0000-0000-000000000002', 'on_review');

-- Задача 3: в работе
select pg_temp.act_as('20000000-0000-0000-0000-000000000001');
select public.change_task_status('40000000-0000-0000-0000-000000000003', 'in_progress');

-- Задача 4: на доработке
select pg_temp.act_as('20000000-0000-0000-0000-000000000002');
select public.change_task_status('40000000-0000-0000-0000-000000000004', 'in_progress');
select public.change_task_status('40000000-0000-0000-0000-000000000004', 'on_review');
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select public.change_task_status('40000000-0000-0000-0000-000000000004', 'rework', 'Не закреплён конёк, переделать');

-- Задачи 5 и 6 остаются в статусе «Новая»

select set_config('request.jwt.claims', '', false);
