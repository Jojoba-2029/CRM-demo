interface MaybePgError {
  code?: string;
  message?: string;
}

/** Человекочитаемый текст ошибки Supabase/Postgres. */
export function errorMessage(error: unknown): string {
  if (!error) return "Неизвестная ошибка";
  const e = error as MaybePgError;
  switch (e.code) {
    case "42501":
      return "Недостаточно прав для этого действия";
    case "23503":
      return "Запись связана с другими данными и не может быть изменена";
    case "23514":
      return e.message?.includes("check constraint")
        ? "Заполните обязательные поля"
        : (e.message ?? "Неверные данные");
    case "PGRST116":
      return "Запись не найдена или недоступна";
  }
  if (e.message === "Invalid login credentials") return "Неверный email или пароль";
  if (e.message) return e.message;
  return typeof error === "string" ? error : "Неизвестная ошибка";
}
