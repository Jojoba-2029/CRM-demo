# Мини-CRM «Объекты и задачи»

CRM для строительной компании: постановщики ставят задачи по объектам (стройкам), исполнители выполняют их и отдают на проверку.

**Стек:** React 19 + TypeScript 7, Vite, Mantine, Supabase (Postgres, Auth, RLS).

- [Как устроена система — для руководителя](docs/overview.md)
- [Решения и допущения](docs/decisions.md)
- [Нюансы, коллизии и открытые вопросы](docs/known-issues.md)
- [Деплой: GitHub Pages + Actions + Supabase](docs/deployment.md)

## Локальный запуск

Нужны Node.js 24.15+ (LTS; версия указана в `.node-version`; её проверяют `yarn install`, `yarn dev` и `yarn build`), Yarn 4 и запущенный Docker Desktop (для локального Supabase).

Версия Yarn закреплена в `package.json` (`packageManager`), её подставляет [Corepack](https://yarnpkg.com/corepack). В Node.js 25+ Corepack не входит в поставку, его ставят отдельно:

```bash
npm install -g corepack
corepack enable
```

Если глобально установлен Yarn 1 и он стоит в `PATH` раньше Corepack, запускайте команды через `corepack yarn …`.

```bash
yarn install
yarn db:start         # поднимает локальный Supabase, применяет миграции и seed
yarn db:status        # показывает API URL и anon key
```

Создайте `.env.local` по образцу `.env.example` и вставьте туда `API URL` и `anon key` из вывода предыдущей команды. Затем:

```bash
yarn dev              # http://localhost:5173
```

### Тестовые пользователи (локально)

Пароль у всех:`Password123!`

| Email               | Роль        | Пароль       |
| ------------------- | ----------- | ------------ |
| manager@crm.local   | Постановщик | Password123! |
| executor1@crm.local | Исполнитель | Password123! |
| executor2@crm.local | Исполнитель | Password123! |

В базе 3 объекта и 6 задач во всех статусах, у части задач есть история с возвратом на доработку.

## Команды

| Команда                     | Что делает                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `yarn dev`                  | фронтенд в режиме разработки                                                                                                |
| `yarn build`                | проверка типов и сборка в `dist/`                                                                                           |
| `yarn verify`               | всё перед коммитом: форматирование, типы, линтер, unit-тесты                                                                |
| `yarn typecheck`            | проверка типов                                                                                                              |
| `yarn lint`                 | линтер [Oxlint](https://oxc.rs/docs/guide/usage/linter) с проверками на основе типов; предупреждения тоже считаются ошибкой |
| `yarn lint:fix`             | автоисправление того, что Oxlint умеет исправлять                                                                           |
| `yarn format`               | отформатировать код и документацию ([Oxfmt](https://oxc.rs/docs/guide/usage/formatter))                                     |
| `yarn format:check`         | проверить форматирование без изменений                                                                                      |
| `yarn test`                 | unit-тесты фронтенда (Vitest)                                                                                               |
| `yarn db:start` / `db:stop` | запуск и остановка локального Supabase                                                                                      |
| `yarn db:reset`             | пересоздать локальную базу: миграции + seed                                                                                 |
| `yarn db:test`              | тесты безопасности базы (pgTAP): RLS, переходы статусов, история                                                            |
| `yarn db:types`             | сгенерировать типы TypeScript по схеме базы                                                                                 |

Настройки линтера — в `.oxlintrc.json`, форматтера — в `.oxfmtrc.json`; окончания строк LF закреплены в `.gitattributes`. Для редактора есть расширение Oxc (VS Code и др.): оно подхватывает оба конфига. Yarn 4 по умолчанию не ставит версии пакетов, опубликованные меньше суток назад (`npmMinimalAgeGate`): это защита от атак через цепочку поставок, её стоит оставить включённой.

## Структура

```
supabase/
  migrations/      схема, права доступа (RLS), функция смены статуса, триггеры
  seed.sql         тестовые данные для локальной базы
  tests/database/  pgTAP-тесты безопасности
  config.toml      локальная конфигурация (регистрация отключена)
src/
  lib/taskStatus.ts  статусы и доступные действия в интерфейсе
  auth/              сессия, профиль, защита маршрутов
  pages/             экраны: вход, объекты, карточка объекта, карточка задачи, «Мои задачи»
  components/        формы и общие компоненты
```

## Деплой

Приложение публикуется бесплатно: фронтенд — на **GitHub Pages**, база и авторизация — в **Supabase Free**, сборка и миграции — через **GitHub Actions** (`.github/workflows/deploy.yml`, на каждый пуш в `main`). Пошаговая настройка (secrets, variables, Supabase Auth, тестовые данные) и разбор ошибок — в [docs/deployment.md](docs/deployment.md).

Без автоматики миграции можно применить вручную: `yarn supabase link --project-ref <ref>` и `yarn supabase db push --remote` (без `--remote` CLI 3 применяет миграции к локальной базе).

**Пользователи в облаке.** Тестовых пользователей создаёт `supabase/seed.sql` (запускается один раз в SQL Editor). Новых пользователей можно добавить в **Authentication → Users → Add user** (email + пароль, _Auto Confirm User_): каждый получает роль «Исполнитель». Постановщика назначают в SQL Editor:

```sql
update public.profiles set role = 'manager', full_name = 'Имя Фамилия' where email = 'manager@example.com';
```

Имена исполнителей задаются так же (`full_name`).

Ключ `service_role` (secret key) во фронтенде, в репозитории и в настройках Actions не используется и не нужен.
