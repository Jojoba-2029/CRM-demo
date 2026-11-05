-- Переходы статусов и история
begin;
create extension if not exists pgtap with schema extensions;

select plan(32);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'm1@test.local', '', now(), '{"role":"manager"}', '{"full_name":"Постановщик 1"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'm2@test.local', '', now(), '{"role":"manager"}', '{"full_name":"Постановщик 2"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'e1@test.local', '', now(), '{}', '{"full_name":"Исполнитель 1"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'e2@test.local', '', now(), '{}', '{"full_name":"Исполнитель 2"}', now(), now());

insert into public.objects (id, name, address, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ЖК Север', 'ул. Ленина, 1', '11111111-1111-1111-1111-111111111111');

-- Задачу создаёт постановщик через API
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.tasks (id, object_id, title, assignee_id)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Залить фундамент', '22222222-2222-2222-2222-222222222222');
reset role;

select results_eq(
  $$select from_status::text, to_status::text, changed_by from public.task_status_history where task_id = 'bbbbbbbb-0000-0000-0000-000000000001'$$,
  $$values (null::text, 'new'::text, '11111111-1111-1111-1111-111111111111'::uuid)$$,
  'создание задачи записано в историю');

-- Постановщик не может брать задачу в работу
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select throws_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'in_progress')$$, 'PT403', null, 'новая → в работе: не постановщик');
select throws_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'accepted')$$, 'PT403', null, 'новая → принята запрещено');
reset role;

-- Чужой исполнитель не видит задачу
set local role authenticated;
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select throws_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'in_progress')$$, 'PT404', null, 'чужой исполнитель не может взять задачу');
select is((select count(*)::int from public.task_status_history), 0, 'чужой исполнитель не видит историю чужой задачи');
reset role;

-- Назначенный исполнитель
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'on_review')$$, 'PT403', null, 'новая → на проверке запрещено');
select throws_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'rework', 'x')$$, 'PT403', null, 'новая → на доработке запрещено');
select throws_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'new')$$, 'PT403', null, 'новая → новая запрещено');
select lives_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'in_progress')$$, 'новая → в работе: назначенный исполнитель');
select is((select status::text from public.tasks where id = 'bbbbbbbb-0000-0000-0000-000000000001'), 'in_progress', 'статус стал in_progress');
select throws_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'accepted')$$, 'PT403', null, 'исполнитель не может принять задачу');
select throws_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'new')$$, 'PT403', null, 'в работе → новая запрещено');
select lives_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'on_review')$$, 'в работе → на проверке: исполнитель');
select throws_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'accepted')$$, 'PT403', null, 'исполнитель не принимает задачу на проверке');
select throws_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'rework', 'сам себе')$$, 'PT403', null, 'исполнитель не возвращает задачу на доработку');
select throws_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'in_progress')$$, 'PT403', null, 'на проверке → в работе запрещено');

-- История нельзя подделать
select throws_ok($$insert into public.task_status_history (task_id, from_status, to_status, changed_by) values ('bbbbbbbb-0000-0000-0000-000000000001', 'on_review', 'accepted', '11111111-1111-1111-1111-111111111111')$$, '42501', null, 'исполнитель не может добавить запись истории');
select throws_ok($$update public.task_status_history set comment = 'x'$$, '42501', null, 'исполнитель не может изменить историю');
select throws_ok($$delete from public.task_status_history$$, '42501', null, 'исполнитель не может удалить историю');
select is((select count(*)::int from public.task_status_history), 3, 'исполнитель видит историю своей задачи');
reset role;

-- Другой постановщик возвращает на доработку
set local role authenticated;
set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select throws_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'rework')$$, 'PT400', null, 'на доработку без комментария нельзя');
select throws_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'rework', '   ')$$, 'PT400', null, 'комментарий из пробелов не считается');
select lives_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'rework', '  Переделать опалубку ')$$, 'на проверке → на доработке с комментарием');
select results_eq(
  $$select from_status::text, to_status::text, changed_by, comment from public.task_status_history where task_id = 'bbbbbbbb-0000-0000-0000-000000000001' and to_status = 'rework'$$,
  $$values ('on_review'::text, 'rework'::text, '44444444-4444-4444-4444-444444444444'::uuid, 'Переделать опалубку'::text)$$,
  'возврат записан в историю: кто, откуда, куда, комментарий');
select throws_ok($$insert into public.task_status_history (task_id, to_status) values ('bbbbbbbb-0000-0000-0000-000000000001', 'accepted')$$, '42501', null, 'постановщик тоже не пишет историю напрямую');
select throws_ok($$delete from public.task_status_history$$, '42501', null, 'постановщик не удаляет историю');
reset role;

-- Исполнитель снова берёт в работу и сдаёт
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select lives_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'in_progress')$$, 'на доработке → в работе: исполнитель');
select lives_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'on_review')$$, 'снова на проверку');
reset role;

-- Постановщик принимает
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select lives_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'accepted')$$, 'на проверке → принята: постановщик');
select throws_ok($$select public.change_task_status('bbbbbbbb-0000-0000-0000-000000000001', 'rework', 'поздно')$$, 'PT403', null, 'из принята переходов нет');
select throws_ok($$update public.tasks set title = 'изменено' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$, 'PT409', null, 'принятую задачу нельзя редактировать');
reset role;

select is((select count(*)::int from public.task_status_history where task_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 7, 'в истории все 7 смен статуса');

select * from finish();
rollback;
