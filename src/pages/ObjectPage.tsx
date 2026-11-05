import { useState } from "react";
import { Anchor, Breadcrumbs, Button, Group, Stack, Table, Text, Title } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useProfile } from "../auth/AuthProvider";
import { ObjectFormModal } from "../components/ObjectFormModal";
import { PageState } from "../components/PageState";
import { StatusBadge } from "../components/StatusBadge";
import { TaskFormModal } from "../components/TaskFormModal";
import { errorMessage } from "../lib/errors";
import { supabase } from "../lib/supabase";
import { useLoad } from "../lib/useLoad";
import { unwrap } from "../lib/unwrap";
import { formatDate } from "../lib/format";

export function ObjectPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const profile = useProfile();
  const isManager = profile.role === "manager";
  const [objectFormOpened, setObjectFormOpened] = useState(false);
  const [taskFormOpened, setTaskFormOpened] = useState(false);

  const { data, loading, error, reload } = useLoad(`object:${id}`, async () => {
    const [objectResult, tasksResult] = await Promise.all([
      supabase.from("objects").select("id, name, address").eq("id", id).maybeSingle(),
      // Исполнителю RLS вернёт только его задачи
      supabase
        .from("tasks")
        .select(
          "id, title, status, created_at, assignee:profiles!tasks_assignee_id_fkey(full_name)",
        )
        .eq("object_id", id)
        .order("created_at", { ascending: false }),
    ]);
    return { object: unwrap(objectResult), tasks: unwrap(tasksResult) };
  });

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: "Удалить объект?",
      children: (
        <Text size="sm">
          Объект будет удалён вместе со всеми задачами ({data?.tasks.length ?? 0}) и их историей.
        </Text>
      ),
      labels: { confirm: "Удалить", cancel: "Отмена" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        const { error: deleteError } = await supabase.from("objects").delete().eq("id", id);
        if (deleteError) {
          notifications.show({ color: "red", message: errorMessage(deleteError) });
          return;
        }
        void navigate("/objects");
      },
    });

  if (!data) return <PageState loading={loading} error={error} onRetry={reload} />;
  if (!data.object) return <Text>Объект не найден или у вас нет к нему доступа.</Text>;

  const { object, tasks } = data;

  return (
    <Stack>
      {/* Ошибка повторной загрузки: данные выше — последние успешно загруженные */}
      <PageState loading={false} error={error} onRetry={reload} />
      <Breadcrumbs>
        <Anchor component={Link} to="/objects">
          Объекты
        </Anchor>
        <Text>{object.name}</Text>
      </Breadcrumbs>

      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>{object.name}</Title>
          <Text c="dimmed">{object.address}</Text>
        </div>
        {isManager && (
          <Group gap="xs">
            <Button variant="default" onClick={() => setObjectFormOpened(true)}>
              Редактировать
            </Button>
            <Button variant="light" color="red" onClick={confirmDelete}>
              Удалить
            </Button>
          </Group>
        )}
      </Group>

      <Group justify="space-between" mt="md">
        <Title order={3}>{isManager ? "Задачи" : "Мои задачи на объекте"}</Title>
        {isManager && <Button onClick={() => setTaskFormOpened(true)}>Новая задача</Button>}
      </Group>

      {tasks.length === 0 ? (
        <Text c="dimmed">Задач нет.</Text>
      ) : (
        <Table.ScrollContainer minWidth={560}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Задача</Table.Th>
                <Table.Th>Статус</Table.Th>
                <Table.Th>Исполнитель</Table.Th>
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
                    <StatusBadge status={task.status} />
                  </Table.Td>
                  <Table.Td>{task.assignee?.full_name ?? "—"}</Table.Td>
                  <Table.Td>{formatDate(task.created_at)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {isManager && (
        <>
          <ObjectFormModal
            opened={objectFormOpened}
            onClose={() => setObjectFormOpened(false)}
            onSaved={reload}
            object={object}
          />
          <TaskFormModal
            opened={taskFormOpened}
            onClose={() => setTaskFormOpened(false)}
            onSaved={reload}
            objectId={object.id}
          />
        </>
      )}
    </Stack>
  );
}
