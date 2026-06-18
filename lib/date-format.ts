import dayjs from "dayjs";

export function formatDisplayDate(value?: string | null) {
  return value ? dayjs(value).format("DD-MM-YYYY") : "-";
}

export function formatDisplayDateTime(value?: string | null) {
  return value ? dayjs(value).format("HH:mm DD-MM-YYYY") : "-";
}
