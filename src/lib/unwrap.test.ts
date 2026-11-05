import { describe, expect, expectTypeOf, it } from "vitest";
import { PostgrestError, type PostgrestSingleResponse } from "@supabase/supabase-js";
import { unwrap } from "./unwrap";

const ok = <T>(data: T): PostgrestSingleResponse<T> => ({
  success: true,
  data,
  error: null,
  count: null,
  status: 200,
  statusText: "OK",
});

describe("unwrap", () => {
  it("возвращает данные успешного ответа", () => {
    const rows = unwrap(ok([{ id: 1 }]));
    expect(rows).toEqual([{ id: 1 }]);
    expectTypeOf(rows).toEqualTypeOf<{ id: number }[]>();
  });

  it("для maybeSingle сохраняет null как «не найдено»", () => {
    const row = unwrap(ok<{ id: number } | null>(null));
    expect(row).toBeNull();
    expectTypeOf(row).toEqualTypeOf<{ id: number } | null>();
  });

  it("бросает ошибку ответа", () => {
    const error = new PostgrestError({
      message: "permission denied",
      code: "42501",
      details: "",
      hint: "",
    });
    const failed: PostgrestSingleResponse<number> = {
      success: false,
      data: null,
      error,
      count: null,
      status: 403,
      statusText: "Forbidden",
    };
    expect(() => unwrap(failed)).toThrow(error);
  });
});
