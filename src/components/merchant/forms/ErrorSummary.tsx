/**
 * Error summary shown after a failed submit: a boxed alert that stays in view
 * (floating at the side of the screen on wide screens, pinned to the top of
 * the form on phones) while the person scrolls to fix each field. Each entry
 * links to its field; the summary is announced as an alert.
 */
export function ErrorSummary({
  errors,
  title = "Check the highlighted fields",
}: {
  errors: ReadonlyArray<{ fieldId: string; message: string }>;
  title?: string;
}) {
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      className="shadow-lg sticky top-2 z-30 border-2 border-sale bg-surface p-4 text-sm lg:fixed lg:top-24 lg:right-6 lg:w-80"
    >
      <p className="flex items-center gap-2 font-medium text-sale">
        <span
          aria-hidden="true"
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sale text-xs font-bold text-surface"
        >
          !
        </span>
        {title}
      </p>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
        {errors.map((e) => (
          <li key={e.fieldId}>
            <a href={`#${e.fieldId}`} className="underline underline-offset-4">
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A form-level message (server error, lockout) that isn't tied to one field. */
export function FormMessage({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={tone === "error" ? "text-sm text-sale" : "text-sm text-success"}
    >
      {children}
    </p>
  );
}
