import type { PostgrestSingleResponse } from "@supabase/supabase-js";

/**
 * Разворачивает ответ supabase-js: бросает ошибку или возвращает данные.
 * Для maybeSingle() тип данных уже включает null — «запись не найдена» остаётся null.
 */
export function unwrap<T>(response: PostgrestSingleResponse<T>): T {
  if (response.error) throw response.error;
  return response.data;
}
