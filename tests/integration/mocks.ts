import type * as NextServer from "next/server";
import { vi } from "vitest";

// Server code marks request-time work with `connection()`; tests run outside a request.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof NextServer>()),
  connection: async () => {},
}));
