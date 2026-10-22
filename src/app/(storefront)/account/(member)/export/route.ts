import { exportAccountData } from "@/lib/account/account-service";
import { hasPermission } from "@/lib/auth/rbac";
import { getSession } from "@/lib/auth/session";

/** GET /account/export: the signed-in customer's data as a JSON download. */
export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "account.manage")) {
    return new Response(null, { status: 401 });
  }
  const data = await exportAccountData(session.uid);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="texora-account-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
