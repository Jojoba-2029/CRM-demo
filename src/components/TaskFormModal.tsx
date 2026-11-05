import { useState, type FormEvent } from "react";
import { Alert, Button, Group, Modal, Select, Stack, TextInput, Textarea } from "@mantine/core";
import { supabase, type Tables } from "../lib/supabase";
import { errorMessage } from "../lib/errors";
import { useLoad, type LoadState } from "../lib/useLoad";
import { unwrap } from "../lib/unwrap";

type EditableTask = Pick<Tables<"tasks">, "id" | "title" | "description" | "assignee_id">;

interface Props {
  opened: boolean;
  onClose: () => void;
  onSaved: (taskId: string) => void;
  objectId: string;
  task?: EditableTask | null;
}

type Executor = Pick<Tables<"profiles">, "id" | "full_name">;

export function TaskFormModal({ opened, onClose, onSaved, objectId, task }: Props) {
  // Список исполнителей грузим один раз на страницу: форма монтируется заново при каждом открытии
  const executors = useLoad("executors", async () =>
    unwrap(
      await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "executor")
        .order("full_name"),
    ),
  );

  return (
    <Modal opened={opened} onClose={onClose} title={task ? "Редактировать задачу" : "Новая задача"}>
      {/* Modal размонтирует содержимое при закрытии, поэтому форма каждый раз стартует с чистого состояния */}
      <TaskForm
        objectId={objectId}
        task={task ?? null}
        executors={executors}
        onCancel={onClose}
        onSaved={onSaved}
      />
    </Modal>
  );
}

interface FormProps {
  objectId: string;
  task: EditableTask | null;
  executors: LoadState<Executor[]>;
  onCancel: () => void;
  onSaved: (taskId: string) => void;
}

function TaskForm({ objectId, task, executors, onCancel, onSaved }: FormProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assigneeId, setAssigneeId] = useState<string | null>(task?.assignee_id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!assigneeId) {
      setError("Выберите исполнителя");
      return;
    }
    setSaving(true);
    const values = {
      title: title.trim(),
      description: description.trim(),
      assignee_id: assigneeId,
    };
    const result = task
      ? await supabase.from("tasks").update(values).eq("id", task.id).select("id").single()
      : await supabase
          .from("tasks")
          .insert({ ...values, object_id: objectId })
          .select("id")
          .single();
    setSaving(false);
    if (result.error) {
      setError(errorMessage(result.error));
      return;
    }
    onSaved(result.data.id);
    onCancel();
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)}>
      <Stack>
        <TextInput
          label="Название"
          required
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          data-autofocus
        />
        <Textarea
          label="Описание"
          autosize
          minRows={3}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        <Select
          label="Исполнитель"
          required
          placeholder={executors.loading ? "Загрузка…" : "Выберите исполнителя"}
          data={(executors.data ?? []).map((p) => ({ value: p.id, label: p.full_name }))}
          value={assigneeId}
          onChange={setAssigneeId}
          searchable
        />
        {executors.error ? <Alert color="red">{errorMessage(executors.error)}</Alert> : null}
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>
            Отмена
          </Button>
          <Button type="submit" loading={saving}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
