import { useState } from "react";
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Group,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { Link } from "react-router-dom";
import { useProfile } from "../auth/AuthProvider";
import { ObjectFormModal } from "../components/ObjectFormModal";
import { PageState } from "../components/PageState";
import { errorMessage } from "../lib/errors";
import { supabase } from "../lib/supabase";
import { STATUS_COLOR, STATUS_LABEL, STATUS_ORDER } from "../lib/taskStatus";
import { useLoad } from "../lib/useLoad";
import { unwrap } from "../lib/unwrap";

type ObjectRow = {
  id: string;
  name: string;
  address: string;
  tasks: { status: keyof typeof STATUS_LABEL }[];
};

export function ObjectsPage() {
  const profile = useProfile();
  const isManager = profile.role === "manager";
  const [editing, setEditing] = useState<ObjectRow | null>(null);
  const [formOpened, setFormOpened] = useState(false);

  // Для исполнителя RLS вернёт только объекты и задачи, где он исполнитель
  const { data, loading, error, reload } = useLoad("objects", async () =>
    unwrap(await supabase.from("objects").select("id, name, address, tasks(status)").order("name")),
  );

  const openForm = (object: ObjectRow | null) => {
    setEditing(object);
    setFormOpened(true);
  };

  const confirmDelete = (object: ObjectRow) =>
    modals.openConfirmModal({
      title: "Удалить объект?",
      children: (
        <Text size="sm">
          Объект «{object.name}» будет удалён вместе со всеми задачами ({object.tasks.length}) и их
          историей.
        </Text>
      ),
      labels: { confirm: "Удалить", cancel: "Отмена" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        const { error: deleteError } = await supabase.from("objects").delete().eq("id", object.id);
        if (deleteError) notifications.show({ color: "red", message: errorMessage(deleteError) });
        reload();
      },
    });

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2}>Объекты</Title>
        {isManager && <Button onClick={() => openForm(null)}>Добавить объект</Button>}
      </Group>

      <PageState loading={loading && !data} error={error} onRetry={reload} />

      {data && data.length === 0 && (
        <Text c="dimmed">
          {isManager ? "Объектов пока нет." : "У вас пока нет задач ни на одном объекте."}
        </Text>
      )}

      {data && data.length > 0 && (
        <Table.ScrollContainer minWidth={600}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Название</Table.Th>
                <Table.Th>Адрес</Table.Th>
                <Table.Th>{isManager ? "Задачи" : "Мои задачи"}</Table.Th>
                {isManager && <Table.Th w={90} />}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((object) => (
                <Table.Tr key={object.id}>
                  <Table.Td>
                    <Anchor component={Link} to={`/objects/${object.id}`} fw={500}>
                      {object.name}
                    </Anchor>
                  </Table.Td>
                  <Table.Td>{object.address}</Table.Td>
                  <Table.Td>
                    <TaskCounters statuses={object.tasks.map((t) => t.status)} />
                  </Table.Td>
                  {isManager && (
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Редактировать">
                          <ActionIcon
                            variant="subtle"
                            aria-label="Редактировать"
                            onClick={() => openForm(object)}
                          >
                            ✎
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Удалить">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label="Удалить"
                            onClick={() => confirmDelete(object)}
                          >
                            ✕
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {isManager && (
        <ObjectFormModal
          opened={formOpened}
          onClose={() => setFormOpened(false)}
          onSaved={reload}
          object={editing}
        />
      )}
    </>
  );
}

function TaskCounters({ statuses }: { statuses: (keyof typeof STATUS_LABEL)[] }) {
  if (statuses.length === 0)
    return (
      <Text size="sm" c="dimmed">
        нет
      </Text>
    );
  return (
    <Group gap={4}>
      {STATUS_ORDER.map((status) => {
        const count = statuses.filter((s) => s === status).length;
        return count > 0 ? (
          <Badge key={status} color={STATUS_COLOR[status]} variant="light">
            {STATUS_LABEL[status]}: {count}
          </Badge>
        ) : null;
      })}
    </Group>
  );
}
