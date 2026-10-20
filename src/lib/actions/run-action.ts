import "server-only";
import type { z } from "zod";
import { AuthorizationError, requirePermission, requireSession } from "@/lib/auth/guard";
import type { Permission } from "@/lib/auth/rbac";
import type { Session } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";

export type ActionErrorCode =
  | "validation"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "limit_exceeded"
  | "internal";

export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: { code: ActionErrorCode; message: string; fieldErrors?: Record<string, string[]> };
    };

/** Throw from a handler to return a specific, user-safe error. */
export class ActionError extends Error {
  constructor(
    public readonly code: Exclude<ActionErrorCode, "validation" | "internal">,
    message: string,
    /** Form field the error belongs to (e.g. "username"), shown inline next to it. */
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

type Access = { permission: Permission } | { authenticated: true } | { public: true };

interface ActionDefinition<S extends z.ZodType, R> {
  schema: S;
  access: Access;
  handler: (input: z.infer<S>, ctx: { session: Session | null }) => Promise<R>;
}

/**
 * The one pipeline every Server Action runs through:
 * validate input (Zod) → authorise (session + permission) → run → typed result.
 * Declare actions in a "use server" file as
 *   export async function doThing(input: unknown) { return runAction(input, def) }
 */
export async function runAction<S extends z.ZodType, R>(
  rawInput: unknown,
  definition: ActionDefinition<S, R>,
): Promise<ActionResult<R>> {
  const parsed = definition.schema.safeParse(
    rawInput instanceof FormData ? Object.fromEntries(rawInput) : rawInput,
  );
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return {
      ok: false,
      error: { code: "validation", message: "Check the highlighted fields", fieldErrors },
    };
  }

  try {
    const { access } = definition;
    const session =
      "permission" in access
        ? await requirePermission(access.permission)
        : "authenticated" in access
          ? await requireSession()
          : null;

    return { ok: true, data: await definition.handler(parsed.data, { session }) };
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return {
        ok: false,
        error: {
          code: error.code,
          message:
            error.code === "unauthenticated"
              ? "Please sign in to continue"
              : "You don't have access to do that",
        },
      };
    }
    if (error instanceof ActionError) {
      return {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.field ? { fieldErrors: { [error.field]: [error.message] } } : {}),
        },
      };
    }
    logger.error("action.failed", { error });
    return {
      ok: false,
      error: { code: "internal", message: "Something went wrong. Please try again." },
    };
  }
}
