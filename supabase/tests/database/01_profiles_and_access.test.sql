-- Профили, роли и базовая закрытость таблиц
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- Фикстуры: два постановщика, два исполнителя
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'm1@test.local', '', now(), '{"role":"manager"}',  '{"full_name":"Постановщик 1"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'm2@test.local', '', now(), '{"role":"manager"}',  '{"full_name":"Постановщик 2"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'e1@test.local', '', now(), '{}',                  '{"full_name":"Исполнитель 1"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'e2@test.local', '', now(), '{"role":"executor"}', '{"full_name":"Исполнитель 2"}', now(), now());

-- Профиль создаётся автоматически, роль берётся из app_metadata (по умолчанию исполнитель)
select is((select role::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'manager', 'профиль постановщика создан с ролью manager');
select is((select role::text from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'executor', 'без роли в app_metadata профиль получает роль executor');
select is((select full_name from public.profiles where id = '33333333-3333-3333-3333-333333333333'), 'Исполнитель 2', 'имя берётся из user_metadata');

-- RLS включён везде
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.profiles'::regclass, 'public.objects'::regclass, 'public.tasks'::regclass, 'public.task_status_history'::regclass)), 'RLS включён на всех таблицах');

insert into public.objects (id, name, address, created_by)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Объект А', 'г. Энск, ул. Тестовая, 1', '11111111-1111-1111-1111-111111111111');

-- Анонимный пользователь не видит ничего
set local role anon;
select throws_ok('select * from public.objects', '42501', null, 'anon не может читать объекты');
select throws_ok('select * from public.profiles', '42501', null, 'anon не может читать профили');
select throws_ok($$select public.change_task_status('aaaaaaaa-0000-0000-0000-000000000001', 'in_progress')$$, '42501', null, 'anon не может вызывать смену статуса');
reset role;

-- Исполнитель видит свой профиль и профили постановщиков, но не других исполнителей
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 1, 'исполнитель видит свой профиль');
select is((select count(*)::int from public.profiles where role = 'manager' and email like '%@test.local'), 2, 'исполнитель видит постановщиков');
select is((select count(*)::int from public.profiles where id = '33333333-3333-3333-3333-333333333333'), 0, 'исполнитель не видит других исполнителей');

-- Роль нельзя поменять через API
select throws_ok($$update public.profiles set role = 'manager' where id = '22222222-2222-2222-2222-222222222222'$$, '42501', null, 'исполнитель не может повысить себе роль');
select throws_ok($$insert into public.profiles (id, email, full_name, role) values (gen_random_uuid(), 'x@x', 'x', 'manager')$$, '42501', null, 'профиль нельзя создать через API');
reset role;

-- Постановщик видит всех
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is((select count(*)::int from public.profiles where email like '%@test.local'), 4, 'постановщик видит все профили');
select throws_ok($$update public.profiles set role = 'executor' where id = '44444444-4444-4444-4444-444444444444'$$, '42501', null, 'роли не меняются через API даже постановщиком');
reset role;

select * from finish();
rollback;
