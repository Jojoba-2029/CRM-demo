import { describe, expect, it } from "vitest";
import { availableActions } from "./taskStatus";

const manager = { id: "m1", role: "manager" as const };
const executor = { id: "e1", role: "executor" as const };
const otherExecutor = { id: "e2", role: "executor" as const };

const task = (status: Parameters<typeof availableActions>[0]["status"]) => ({
  status,
  assignee_id: "e1",
});

const targets = (...args: Parameters<typeof availableActions>) =>
  availableActions(...args).map((a) => a.to);

describe("availableActions", () => {
  it("назначенный исполнитель берёт новую задачу в работу", () => {
    expect(targets(task("new"), executor)).toEqual(["in_progress"]);
  });

  it("назначенный исполнитель отправляет задачу на проверку", () => {
    expect(targets(task("in_progress"), executor)).toEqual(["on_review"]);
  });

  it("назначенный исполнитель берёт в работу задачу с доработки", () => {
    expect(targets(task("rework"), executor)).toEqual(["in_progress"]);
  });

  it("постановщик принимает или возвращает задачу на проверке", () => {
    expect(targets(task("on_review"), manager)).toEqual(["accepted", "rework"]);
  });

  it("возврат на доработку требует комментарий, остальные — нет", () => {
    const actions = availableActions(task("on_review"), manager);
    expect(actions.find((a) => a.to === "rework")?.commentRequired).toBe(true);
    expect(actions.find((a) => a.to === "accepted")?.commentRequired).toBe(false);
  });

  it("постановщик не двигает задачу за исполнителя", () => {
    for (const s of ["new", "in_progress", "rework", "accepted"] as const) {
      expect(targets(task(s), manager)).toEqual([]);
    }
  });

  it("исполнитель ничего не может сделать с задачей на проверке и принятой", () => {
    expect(targets(task("on_review"), executor)).toEqual([]);
    expect(targets(task("accepted"), executor)).toEqual([]);
  });

  it("чужой исполнитель не видит действий", () => {
    for (const s of ["new", "in_progress", "on_review", "rework", "accepted"] as const) {
      expect(targets(task(s), otherExecutor)).toEqual([]);
    }
  });
});
