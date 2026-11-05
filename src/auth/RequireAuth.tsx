import { Button, Center, Group, Loader, Stack, Text } from "@mantine/core";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { errorMessage } from "../lib/errors";
import { useAuth } from "./AuthProvider";

export function RequireAuth() {
  const { session, profile, profileError, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!profile) {
    return (
      <Center h="100vh" p="md">
        <Stack align="center">
          <Text ta="center">
            {profileError
              ? `Не удалось загрузить профиль: ${errorMessage(profileError)}`
              : "Профиль пользователя не найден. Обратитесь к администратору."}
          </Text>
          <Group>
            {Boolean(profileError) && (
              <Button onClick={() => window.location.reload()}>Повторить</Button>
            )}
            <Button variant="light" onClick={() => void signOut()}>
              Выйти
            </Button>
          </Group>
        </Stack>
      </Center>
    );
  }
  return <Outlet />;
}
