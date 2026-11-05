import { useState } from "react";
import { Anchor, Chip, Group, Table, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { useProfile } from "../auth/AuthProvider";
import { PageState } from "../components/PageState";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "../lib/format";
import { supabase } from "../lib/supabase";
import { STATUS_LABEL, STATUS_ORDER, type TaskStatus } from "../lib/taskStatus";
import { useLoad } from "../lib/useLoad";
import { unwrap } from "../lib/unwrap";

type Filter = "active" | "all" | TaskStatus;

const ACTIVE: ReadonlySet<TaskStatus> = new Set(["new", "in_progress", "rework", "on_review"]);

export function MyTasksPage() {
  const profile = useProfile();
  const [filter, setFilter] = useState<Filter>("active");

  const { data, loading, error, reload } = useLoad(`my-tasks:${profile.id}`, async () =>
    unwrap(
      await supabase
        .from("tasks")
        .select("id, title, status, created_at, object:objects(id, name)")
        .eq("assignee_id", profile.id)
        .order("created_at", { ascending: false }),
    ),
  );

  const tasks = (data ?? []).filter((task) =>
    filter === "all"
      ? true
      : filter === "active"
        ? ACTIVE.has(task.status)
        : task.status === filter,
  );
  const count = (f: Filter) =>
    (data ?? []).filter((t) =>
      f === "all" ? true : f === "active" ? ACTIVE.has(t.status) : t.status === f,
    ).length;

  const filters: Filter[] = ["active", ...STATUS_ORDER, "all"];
  const filterLabel = (f: Filter) =>
    f === "active" ? "Активные" : f === "all" ? "Все" : STATUS_LABEL[f];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2}>Мои задачи</Title>
      </Group>

      <Chip.Group value={filter} onChange={setFilter}>
        <Group gap="xs" mb="md">
          {filters.map((f) => (
            <Chip key={f} value={f} size="sm">
              {filterLabel(f)} ({count(f)})
            </Chip>
          ))}
        </Group>
      </Chip.Group>

      <PageState loading={loading && !data} error={error} onRetry={reload} />

      {data && tasks.length === 0 && <Text c="dimmed">Задач нет.</Text>}

      {tasks.length > 0 && (
        <Table.ScrollContainer minWidth={560}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Задача</Table.Th>
                <Table.Th>Объект</Table.Th>
                <Table.Th>Статус</Table.Th>
                <Table.Th>Создана</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {tasks.map((task) => (
                <Table.Tr key={task.id}>
                  <Table.Td>
                    <Anchor component={Link} to={`/tasks/${task.id}`} fw={500}>
                      {task.title}
                    </Anchor>
                  </Table.Td>
                  <Table.Td>
                    {task.object && (
                      <Anchor component={Link} to={`/objects/${task.object.id}`} c="dimmed">
                        {task.object.name}
                      </Anchor>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={task.status} />
                  </Table.Td>
                  <Table.Td>{formatDate(task.created_at)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </>
  );
}
