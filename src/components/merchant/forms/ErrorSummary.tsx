/**
 * Error summary shown above a form after a failed submit. Each entry links to
 * its field; the form moves focus to the first invalid field and this
 * summary is announced as an alert. Errors are never shown as toasts alone.
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
    <div role="alert" className="border border-sale bg-surface p-4 text-sm">
      <p className="font-medium text-sale">{title}</p>
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
