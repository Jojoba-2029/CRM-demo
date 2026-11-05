import { Alert, Button, Center, Loader } from "@mantine/core";
import { errorMessage } from "../lib/errors";

/** Индикатор загрузки или ошибка; null — можно рисовать данные. */
export function PageState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: unknown;
  onRetry?: () => void;
}) {
  if (error) {
    return (
      <Alert color="red" title="Не удалось загрузить данные">
        {errorMessage(error)}
        {onRetry && (
          <Button size="xs" variant="light" color="red" mt="sm" display="block" onClick={onRetry}>
            Повторить
          </Button>
        )}
      </Alert>
    );
  }
  if (loading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }
  return null;
}
