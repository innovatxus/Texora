import "server-only";
import { parseEnv, serverEnvSchema } from "./schema";

/** Server-only secrets and configuration. Importing this from a Client Component fails the build. */
export const serverEnv = parseEnv(serverEnvSchema, process.env, "server");
