import { AppShell, Badge, Button, Group, Text } from "@mantine/core";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth, useProfile } from "../auth/AuthProvider";
import classes from "./Layout.module.css";

export function Layout() {
  const profile = useProfile();
  const { signOut } = useAuth();
  const isManager = profile.role === "manager";

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="lg" wrap="nowrap">
            <Text fw={700}>Мини-CRM</Text>
            <NavLink to="/objects" className={classes.link}>
              Объекты
            </NavLink>
            {!isManager && (
              <NavLink to="/my-tasks" className={classes.link}>
                Мои задачи
              </NavLink>
            )}
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Text size="sm" visibleFrom="sm">
              {profile.full_name}
            </Text>
            <Badge variant="outline" visibleFrom="xs">
              {isManager ? "Постановщик" : "Исполнитель"}
            </Badge>
            <Button size="xs" variant="subtle" onClick={() => void signOut()}>
              Выйти
            </Button>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main maw={1100} mx="auto">
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
