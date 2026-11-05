# 13. Деплой приложения

**Метка:** `infra`  
**Статус:** частично — GitHub Actions + GitHub Pages настроены (`.github/workflows/deploy.yml`, docs/deployment.md), первый запуск ждёт secrets/variables в репозитории

- [ ] Облачный проект Supabase, применены миграции
- [x] Деплой фронтенда на GitHub Pages через Actions; в окружении только `VITE_SUPABASE_URL` и publishable/anon key
- [ ] Настроены Site URL и Redirect URLs в Supabase Auth
- [ ] Проверка по ссылке под всеми тестовыми пользователями
