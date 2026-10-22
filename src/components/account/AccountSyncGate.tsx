import { getSession } from "@/lib/auth/session";
import { AccountSync } from "./AccountSync";

/** Reads the session (request-time) and starts syncing for signed-in shoppers. */
export async function AccountSyncGate() {
  const session = await getSession();
  const uid = session && session.role !== "guest" ? session.uid : null;
  return <AccountSync uid={uid} />;
}
