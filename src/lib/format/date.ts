import { LOCALE, TIME_ZONE } from "@/config/locale";
/** Shared date formatters for the back office and merchant portal. */
const dateTime = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const dateOnly = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "Oct 19, 3:04 PM" in the server's time zone. */
export const formatDateTime = (d: Date) => dateTime.format(d);
/** "Oct 19, 2026". */
export const formatDate = (d: Date) => dateOnly.format(d);
