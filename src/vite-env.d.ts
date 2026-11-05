// Типы vite/client подключены в tsconfig.app.json; здесь только переменные окружения проекта.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
