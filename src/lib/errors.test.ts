import { describe, expect, it } from "vitest";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("сообщения из функций базы показываются как есть", () => {
    expect(
      errorMessage({ code: "PT400", message: "При возврате на доработку нужен комментарий" }),
    ).toBe("При возврате на доработку нужен комментарий");
  });

  it("отказ в правах переводится", () => {
    expect(errorMessage({ code: "42501", message: "permission denied for table tasks" })).toBe(
      "Недостаточно прав для этого действия",
    );
  });

  it("нарушение check-ограничения переводится, а сообщение триггера — нет", () => {
    expect(
      errorMessage({
        code: "23514",
        message: 'new row violates check constraint "tasks_title_check"',
      }),
    ).toBe("Заполните обязательные поля");
    expect(
      errorMessage({
        code: "23514",
        message: "Исполнителем может быть только пользователь с ролью «Исполнитель»",
      }),
    ).toBe("Исполнителем может быть только пользователь с ролью «Исполнитель»");
  });

  it("неверный пароль", () => {
    expect(errorMessage({ message: "Invalid login credentials" })).toBe(
      "Неверный email или пароль",
    );
  });
});
