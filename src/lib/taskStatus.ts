import type { Database } from "./database.types";

export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type UserRole = Database["public"]["Enums"]["user_role"];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  new: "Новая",
  in_progress: "В работе",
  on_review: "На проверке",
  accepted: "Принята",
  rework: "На доработке",
};

export const STATUS_COLOR: Record<TaskStatus, string> = {
  new: "gray",
  in_progress: "blue",
  on_review: "yellow",
  accepted: "green",
  rework: "red",
};

export const STATUS_ORDER: TaskStatus[] = ["new", "in_progress", "rework", "on_review", "accepted"];

type Actor = "manager" | "assignee";

export interface TaskAction {
  to: TaskStatus;
  label: string;
  actor: Actor;
  commentRequired: boolean;
  color: string;
}

/**
 * Переходы статусов. Это копия правил из базы (private.transition_actor
 * и public.change_task_status): интерфейс по ней решает, какие кнопки показать,
 * а проверяет переход всё равно база.
 */
const TRANSITIONS: Record<TaskStatus, TaskAction[]> = {
  new: [
    {
      to: "in_progress",
      label: "Взять в работу",
      actor: "assignee",
      commentRequired: false,
      color: "blue",
    },
  ],
  in_progress: [
    {
      to: "on_review",
      label: "Отправить на проверку",
      actor: "assignee",
      commentRequired: false,
      color: "yellow",
    },
  ],
  on_review: [
    { to: "accepted", label: "Принять", actor: "manager", commentRequired: false, color: "green" },
    {
      to: "rework",
      label: "Вернуть на доработку",
      actor: "manager",
      commentRequired: true,
      color: "red",
    },
  ],
  rework: [
    {
      to: "in_progress",
      label: "Взять в работу",
      actor: "assignee",
      commentRequired: false,
      color: "blue",
    },
  ],
  accepted: [],
};

export function availableActions(
  task: { status: TaskStatus; assignee_id: string },
  user: { id: string; role: UserRole },
): TaskAction[] {
  return TRANSITIONS[task.status].filter((action) =>
    action.actor === "manager" ? user.role === "manager" : task.assignee_id === user.id,
  );
}
