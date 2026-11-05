import { useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { errorMessage } from "../lib/errors";
import { useAuth } from "../auth/AuthProvider";

export function LoginPage() {
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) setError(errorMessage(signInError));
    setSubmitting(false);
  };

  return (
    <Center mih="100vh" p="md">
      <Paper withBorder shadow="sm" p="xl" radius="md" w="100%" maw={380}>
        <form onSubmit={(e) => void onSubmit(e)}>
          <Stack>
            <div>
              <Title order={3}>Вход</Title>
              <Text size="sm" c="dimmed">
                Мини-CRM «Объекты и задачи»
              </Text>
            </div>
            <TextInput
              label="Email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
            <PasswordInput
              label="Пароль"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
            {error && <Alert color="red">{error}</Alert>}
            <Button type="submit" loading={submitting}>
              Войти
            </Button>
            <Text size="xs" c="dimmed">
              Регистрация закрыта. Учётную запись выдаёт администратор.
            </Text>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
