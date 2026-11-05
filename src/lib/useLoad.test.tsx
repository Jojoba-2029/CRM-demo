import { StrictMode, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useLoad } from "./useLoad";

const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;

describe("useLoad", () => {
  it("загружает данные", async () => {
    const { result } = renderHook(() => useLoad("answer", async () => 42), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe(42));
    expect(result.current.loading).toBe(false);
  });

  it("возвращает ошибку загрузки", async () => {
    const failure = new Error("нет сети");
    const { result } = renderHook(() => useLoad("broken", () => Promise.reject(failure)), {
      wrapper,
    });
    await waitFor(() => expect(result.current.error).toBe(failure));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("при смене ключа сразу сбрасывает старые данные", async () => {
    const { result, rerender } = renderHook(
      ({ id }) => useLoad(`task:${id}`, async () => `task-${id}`),
      {
        wrapper,
        initialProps: { id: "a" },
      },
    );
    await waitFor(() => expect(result.current.data).toBe("task-a"));
    rerender({ id: "b" });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe("task-b"));
  });

  it("reload() оставляет данные на экране до прихода новых", async () => {
    let n = 0;
    const { result } = renderHook(() => useLoad("counter", async () => ++n), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = result.current.data ?? 0;
    act(() => result.current.reload());
    expect(result.current.data).toBe(before);
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe(before + 1));
  });

  it("неудачный reload() оставляет прежние данные и сообщает ошибку", async () => {
    const failure = new Error("нет сети");
    let fail = false;
    const { result } = renderHook(
      () => useLoad("flaky", async () => (fail ? Promise.reject(failure) : "данные")),
      {
        wrapper,
      },
    );
    await waitFor(() => expect(result.current.data).toBe("данные"));
    fail = true;
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe(failure));
    expect(result.current.data).toBe("данные");
    expect(result.current.loading).toBe(false);

    fail = false;
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.data).toBe("данные");
  });

  it("ошибка по новому ключу не показывает данные старого", async () => {
    const failure = new Error("нет доступа");
    const { result, rerender } = renderHook(
      ({ id }) =>
        useLoad(`task:${id}`, async () => (id === "b" ? Promise.reject(failure) : `task-${id}`)),
      { wrapper, initialProps: { id: "a" } },
    );
    await waitFor(() => expect(result.current.data).toBe("task-a"));
    rerender({ id: "b" });
    await waitFor(() => expect(result.current.error).toBe(failure));
    expect(result.current.data).toBeNull();
  });

  it("ответ на устаревший ключ не перетирает новый", async () => {
    const resolvers: Record<string, (v: string) => void> = {};
    const { result, rerender } = renderHook(
      ({ id }) =>
        useLoad(`task:${id}`, () => new Promise<string>((resolve) => (resolvers[id] = resolve))),
      { initialProps: { id: "a" } },
    );
    rerender({ id: "b" });
    await act(async () => resolvers.b?.("task-b"));
    await act(async () => resolvers.a?.("task-a"));
    expect(result.current.data).toBe("task-b");
  });
});
