const dateTime = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });

export function formatDate(value: string): string {
  return dateTime.format(new Date(value));
}
