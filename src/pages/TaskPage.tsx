import { useState } from "react";
import {
  Alert,
  Anchor,
  Breadcrumbs,
  Button,
  Card,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Timeline,
  Title,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useProfile } from "../auth/AuthProvider";
import { PageState } from "../components/PageState";
import { StatusBadge } from "../components/StatusBadge";
import { TaskFormModal } from "../components/TaskFormModal";
import { errorMessage } from "../lib/errors";
import { formatDate } from "../lib/format";
import { supabase } from "../lib/supabase";
import { availableActions, STATUS_COLOR, STATUS_LABEL, type TaskAction } from "../lib/taskStatus";
import { useLoad } from "../lib/useLoad";
import { unwrap } from "../lib/unwrap";

export function TaskPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const profile = useProfile();
  const isManager = profile.role === "manager";
  const [editOpened, setEditOpened] = useState(false);
  const [commentAction, setCommentAction] = useState<TaskAction | null>(null);
  const [comment, setComment] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { data, loading, error, reload } = useLoad(`task:${id}`, async () => {
    const [taskResult, historyResult] = await Promise.all([
      supabase
        .from("tasks")
        .select(
          `id, title, description, status, assignee_id, created_at,
           object:objects(id, name),
           assignee:profiles!tasks_assignee_id_fkey(full_name),
           author:profiles!tasks_author_id_fkey(full_name)`,
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("task_status_history")
        .select(
          "id, from_status, to_status, changed_at, comment, changed_by_profile:profiles(full_name)",
        )
        .eq("task_id", id)
        .order("id"),
    ]);
    return { task: unwrap(taskResult), history: unwrap(historyResult) };
  });

  const closeCommentModal = () => {
    setCommentAction(null);
    setActionError(null);
  };

  const changeStatus = async (action: TaskAction, text?: string) => {
    setPending(true);
    setActionError(null);
    const { error: rpcError } = await supabase.rpc("change_task_status", {
      p_task_id: id,
      p_new_status: action.to,
      p_comment: text?.trim() || undefined,
    });
    setPending(false);
    if (rpcError) {
      setActionError(errorMessage(rpcError));
      return false;
    }
    notifications.show({
      color: STATUS_COLOR[action.to],
      message: `Статус: ${STATUS_LABEL[action.to]}`,
    });
    reload();
    return true;
  };

  const onAction = (action: TaskAction) => {
    setActionError(null);
    if (action.commentRequired) {
      setComment("");
      setActionError(null);
      setCommentAction(action);
    } else {
      void changeStatus(action);
    }
  };

  const submitComment = async () => {
    if (!commentAction) return;
    if (!comment.trim()) return setActionError("Комментарий обязателен");
    if (await changeStatus(commentAction, comment)) closeCommentModal();
  };

  const confirmDelete = () =>
    modals.openConfirmModal({
      title: "Удалить задачу?",
      children: <Text size="sm">Задача будет удалена вместе с историей статусов.</Text>,
      labels: { confirm: "Удалить", cancel: "Отмена" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        const { error: deleteError } = await supabase.from("tasks").delete().eq("id", id);
        if (deleteError) {
          notifications.show({ color: "red", message: errorMessage(deleteError) });
          return;
        }
        void navigate(data?.task?.object ? `/objects/${data.task.object.id}` : "/objects");
      },
    });

  if (!data) return <PageState loading={loading} error={error} onRetry={reload} />;
  if (!data.task) return <Text>Задача не найдена или у вас нет к ней доступа.</Text>;

  const { task, history } = data;
  const actions = availableActions(task, profile);
  const editable = isManager && task.status !== "accepted";

  return (
    <Stack>
      {/* Ошибка повторной загрузки: данные выше — последние успешно загруженные */}
      <PageState loading={false} error={error} onRetry={reload} />
      <Breadcrumbs>
        <Anchor component={Link} to="/objects">
          Объекты
        </Anchor>
        {task.object && (
          <Anchor component={Link} to={`/objects/${task.object.id}`}>
            {task.object.name}
          </Anchor>
        )}
        <Text>{task.title}</Text>
      </Breadcrumbs>

      <Group justify="space-between" align="flex-start">
        <Group gap="sm">
          <Title order={2}>{task.title}</Title>
          <StatusBadge status={task.status} />
        </Group>
        {isManager && (
          <Group gap="xs">
            {editable && (
              <Button variant="default" onClick={() => setEditOpened(true)}>
                Редактировать
              </Button>
            )}
            <Button variant="light" color="red" onClick={confirmDelete}>
              Удалить
            </Button>
          </Group>
        )}
      </Group>

      <Card withBorder>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Field label="Объект" value={task.object?.name ?? "—"} />
          <Field label="Исполнитель" value={task.assignee?.full_name ?? "—"} />
          <Field label="Автор" value={task.author?.full_name ?? "—"} />
          <Field label="Создана" value={formatDate(task.created_at)} />
        </SimpleGrid>
        <Text size="sm" c="dimmed" mt="md">
          Описание
        </Text>
        <Text style={{ whiteSpace: "pre-wrap" }}>{task.description || "—"}</Text>
      </Card>

      {actions.length > 0 && (
        <Group>
          {actions.map((action) => (
            <Button
              key={action.to}
              color={action.color}
              loading={pending}
              onClick={() => onAction(action)}
            >
              {action.label}
            </Button>
          ))}
        </Group>
      )}
      {actionError && !commentAction && <Alert color="red">{actionError}</Alert>}

      <Title order={3} mt="md">
        История
      </Title>
      <Timeline bulletSize={14} lineWidth={2}>
        {history.map((entry) => (
          <Timeline.Item key={entry.id} color={STATUS_COLOR[entry.to_status]}>
            <Text size="sm" fw={500}>
              {entry.from_status ? `${STATUS_LABEL[entry.from_status]} → ` : "Создана: "}
              {STATUS_LABEL[entry.to_status]}
            </Text>
            <Text size="xs" c="dimmed">
              {/* null — профиль удалён или скрыт правами (другой исполнитель) */}
              {entry.changed_by_profile?.full_name ?? "Другой пользователь"} ·{" "}
              {formatDate(entry.changed_at)}
            </Text>
            {entry.comment && (
              <Text size="sm" mt={4} style={{ whiteSpace: "pre-wrap" }}>
                {entry.comment}
              </Text>
            )}
          </Timeline.Item>
        ))}
      </Timeline>

      <Modal
        opened={commentAction !== null}
        onClose={closeCommentModal}
        title={commentAction?.label}
      >
        <Stack>
          <Textarea
            label="Комментарий"
            description="Что нужно исправить"
            required
            autosize
            minRows={3}
            value={comment}
            onChange={(e) => setComment(e.currentTarget.value)}
            data-autofocus
          />
          {actionError && <Alert color="red">{actionError}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={closeCommentModal}>
              Отмена
            </Button>
            <Button
              color={commentAction?.color}
              loading={pending}
              onClick={() => void submitComment()}
            >
              {commentAction?.label}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {editable && task.object && (
        <TaskFormModal
          opened={editOpened}
          onClose={() => setEditOpened(false)}
          onSaved={reload}
          objectId={task.object.id}
          task={task}
        />
      )}
    </Stack>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text>{value}</Text>
    </div>
  );
}
