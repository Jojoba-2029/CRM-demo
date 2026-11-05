-- Видимость и изменение объектов и задач по ролям
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'm1@test.local', '', now(), '{"role":"manager"}', '{"full_name":"Постановщик 1"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'e1@test.local', '', now(), '{}', '{"full_name":"Исполнитель 1"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'e2@test.local', '', now(), '{}', '{"full_name":"Исполнитель 2"}', now(), now());

insert into public.objects (id, name, address, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Объект А', 'г. Энск, ул. Тестовая, 1', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Объект Б', 'г. Энск, ул. Тестовая, 2', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Объект В', 'г. Энск, ул. Тестовая, 3', '11111111-1111-1111-1111-111111111111');

insert into public.tasks (id, object_id, title, description, assignee_id, author_id) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Залить фундамент', '', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Кладка', '', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', 'Кровля', '', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111');

-- Исполнитель 1
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select results_eq('select id from public.tasks order by id', $$values ('bbbbbbbb-0000-0000-0000-000000000001'::uuid)$$, 'исполнитель видит только свои задачи');
select results_eq('select id from public.objects order by id', $$values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid)$$, 'исполнитель видит только объекты со своими задачами');

update public.tasks set title = 'взлом' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
update public.tasks set title = 'взлом' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
delete from public.tasks where id = 'bbbbbbbb-0000-0000-0000-000000000001';
update public.objects set name = 'взлом' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
delete from public.objects where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select throws_ok($$insert into public.objects (name, address) values ('x', 'y')$$, '42501', null, 'исполнитель не может создать объект');
select throws_ok($$insert into public.tasks (object_id, title, assignee_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'x', '22222222-2222-2222-2222-222222222222')$$, '42501', null, 'исполнитель не может создать задачу');
select throws_ok($$update public.tasks set status = 'accepted' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$, '42501', null, 'статус нельзя изменить прямым update');
select throws_ok($$update public.tasks set assignee_id = '22222222-2222-2222-2222-222222222222', author_id = '22222222-2222-2222-2222-222222222222' where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$, '42501', null, 'автора задачи нельзя изменить');
select throws_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000002', 'in_progress')$$, 'PT404', null, 'исполнитель не может менять статус чужой задачи');
reset role;

select is((select title from public.tasks where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'Кладка', 'чужая задача не изменена');
select is((select title from public.tasks where id = 'bbbbbbbb-0000-0000-0000-000000000001'), 'Залить фундамент', 'свою задачу исполнитель тоже не редактирует');
select is((select count(*)::int from public.tasks where id = 'bbbbbbbb-0000-0000-0000-000000000001'), 1, 'исполнитель не может удалить задачу');
select is((select name from public.objects where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'Объект А', 'исполнитель не может изменить объект');
select is((select count(*)::int from public.objects where id::text like 'aaaaaaaa-%'), 3, 'исполнитель не может удалить объект');

-- Постановщик
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select count(*)::int from public.tasks where id::text like 'bbbbbbbb-%'), 3, 'постановщик видит все задачи');
select is((select count(*)::int from public.objects where id::text like 'aaaaaaaa-%'), 3, 'постановщик видит все объекты');

select lives_ok($$insert into public.objects (id, name, address) values ('aaaaaaaa-0000-0000-0000-000000000004', 'Новый', 'адрес')$$, 'постановщик создаёт объект');
select is((select created_by from public.objects where id = 'aaaaaaaa-0000-0000-0000-000000000004'), '11111111-1111-1111-1111-111111111111'::uuid, 'создатель объекта проставлен базой');

select lives_ok($$insert into public.tasks (id, object_id, title, description, assignee_id) values ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000004', 'Новая задача', 'описание', '22222222-2222-2222-2222-222222222222')$$, 'постановщик создаёт задачу');
select is((select status::text || '/' || author_id::text from public.tasks where id = 'bbbbbbbb-0000-0000-0000-000000000004'), 'new/11111111-1111-1111-1111-111111111111', 'новая задача: статус new, автор — текущий пользователь');

select throws_ok($$insert into public.tasks (object_id, title, assignee_id, status) values ('aaaaaaaa-0000-0000-0000-000000000004', 'x', '22222222-2222-2222-2222-222222222222', 'accepted')$$, '42501', null, 'статус при создании задать нельзя');
select throws_ok($$insert into public.tasks (object_id, title, assignee_id) values ('aaaaaaaa-0000-0000-0000-000000000004', 'x', '11111111-1111-1111-1111-111111111111')$$, '23514', null, 'исполнителем может быть только пользователь с ролью executor');
select throws_ok($$insert into public.tasks (object_id, title, assignee_id) values ('aaaaaaaa-0000-0000-0000-000000000004', '   ', '22222222-2222-2222-2222-222222222222')$$, '23514', null, 'пустое название задачи запрещено');

select lives_ok($$update public.tasks set title = 'Кладка стен', assignee_id = '22222222-2222-2222-2222-222222222222' where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$, 'постановщик редактирует задачу и переназначает исполнителя');
select throws_ok($$update public.tasks set status = 'accepted' where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$, '42501', null, 'постановщик тоже не меняет статус напрямую');

-- Каскадное удаление объекта
delete from public.objects where id = 'aaaaaaaa-0000-0000-0000-000000000004';
reset role;
select is((select count(*)::int from public.tasks where id = 'bbbbbbbb-0000-0000-0000-000000000004'), 0, 'удаление объекта удаляет его задачи');

-- Создатель объекта не подделывается, а удаление пользователя обнуляет ссылку
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok($$update public.objects set created_by = '22222222-2222-2222-2222-222222222222' where id = 'aaaaaaaa-0000-0000-0000-000000000003'$$, '42501', null, 'создателя объекта нельзя изменить');
reset role;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '55555555-5555-5555-5555-555555555555', 'authenticated', 'authenticated', 'm3@test.local', '', now(), '{"role":"manager"}', now(), now());
insert into public.objects (id, name, address, created_by) values ('aaaaaaaa-0000-0000-0000-000000000005', 'Временный', 'адрес', '55555555-5555-5555-5555-555555555555');
select lives_ok($$delete from auth.users where id = '55555555-5555-5555-5555-555555555555'$$, 'пользователя-создателя объекта можно удалить');

select * from finish();
rollback;
