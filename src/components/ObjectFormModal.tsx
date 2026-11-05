import { useState, type FormEvent } from "react";
import { Alert, Button, Group, Modal, Stack, TextInput } from "@mantine/core";
import { supabase, type Tables } from "../lib/supabase";
import { errorMessage } from "../lib/errors";

type EditableObject = Pick<Tables<"objects">, "id" | "name" | "address">;

interface Props {
  opened: boolean;
  onClose: () => void;
  onSaved: () => void;
  object?: EditableObject | null;
}

export function ObjectFormModal({ opened, onClose, onSaved, object }: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={object ? "Редактировать объект" : "Новый объект"}
    >
      {/* Modal размонтирует содержимое при закрытии, поэтому форма каждый раз стартует с чистого состояния */}
      <ObjectForm object={object ?? null} onCancel={onClose} onSaved={onSaved} />
    </Modal>
  );
}

interface FormProps {
  object: EditableObject | null;
  onCancel: () => void;
  onSaved: () => void;
}

function ObjectForm({ object, onCancel, onSaved }: FormProps) {
  const [name, setName] = useState(object?.name ?? "");
  const [address, setAddress] = useState(object?.address ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const values = { name: name.trim(), address: address.trim() };
    const result = object
      ? await supabase.from("objects").update(values).eq("id", object.id)
      : await supabase.from("objects").insert(values);
    setSaving(false);
    if (result.error) {
      setError(errorMessage(result.error));
      return;
    }
    onSaved();
    onCancel();
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)}>
      <Stack>
        <TextInput
          label="Название"
          required
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          data-autofocus
        />
        <TextInput
          label="Адрес"
          required
          value={address}
          onChange={(e) => setAddress(e.currentTarget.value)}
        />
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
