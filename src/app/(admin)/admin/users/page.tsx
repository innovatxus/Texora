import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionButton } from "@/components/admin/ActionButton";
import { ActionForm } from "@/components/admin/ActionForm";
import { AdminLoading } from "@/components/admin/AdminLoading";
import { AdminField, AdminPageHeader, adminControl, FilterBar, Panel } from "@/components/admin/ui";
import { searchUsers } from "@/lib/admin/people-service";
import { changeRoleAction, inviteStaffAction, revokeSessionsAction } from "@/lib/admin/ops-actions";
import { requirePagePermission } from "@/lib/auth/guard";
import { hasPermission, isOwnerOnlyRole, ROLE_LABELS, ROLES, STAFF_ROLES } from "@/lib/auth/rbac";

/** Users title. */
export const metadata: Metadata = { title: "Users & roles" };

const param = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Users({ searchParams }: PageProps<"/admin/users">) {
  const session = await requirePagePermission("users.read");
  const q = param((await searchParams).q);
  const canAssign = hasPermission(session.role, "users.assign_role");
  const canRevoke = hasPermission(session.role, "users.revoke_sessions");
  // A search covers every account (to promote a customer); otherwise list staff.
  const users = await searchUsers(q ? { q } : { staff: true });
  const assignable = ROLES.filter(
    (r) => r !== "guest" && (session.role === "super_admin" || !isOwnerOnlyRole(r)),
  );

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Users & roles"
        description="Staff accounts and their roles. Role changes sign the person out so the new role applies at once."
      />
      <FilterBar action="/admin/users">
        <AdminField label="Find any account by email or name">
          <input name="q" defaultValue={q} className={`${adminControl} w-72`} />
        </AdminField>
      </FilterBar>

      <div
        tabIndex={0}
        role="region"
        aria-label={q ? "Matching accounts" : "Staff"}
        className="overflow-x-auto border border-line bg-surface focus-visible:outline-2 focus-visible:outline-ink"
      >
        <table className="w-full text-sm">
          <caption className="sr-only">{q ? "Matching accounts" : "Staff"}</caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-subtle">
              <th scope="col" className="px-3 py-2 font-medium">
                Person
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Role
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Sessions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const self = u.uid === session.uid;
              return (
                <tr key={u.uid} className="border-b border-line align-top last:border-0">
                  <td className="px-3 py-2">
                    <span className="font-medium">
                      {u.firstName} {u.lastName}
                    </span>
                    <span className="block text-xs text-ink-soft">{u.email}</span>
                  </td>
                  <td className="px-3 py-2">
                    {canAssign &&
                    !self &&
                    (session.role === "super_admin" || !isOwnerOnlyRole(u.role)) ? (
                      <ActionForm
                        action={changeRoleAction}
                        payload={{ uid: u.uid }}
                        layout="inline"
                        submitLabel="Change"
                        done="Role changed"
                        confirm={`Change the role for ${u.email}?`}
                        resetOnSuccess={false}
                        fields={[
                          {
                            name: "role",
                            label: `Role for ${u.email}`,
                            type: "select",
                            required: true,
                            defaultValue: u.role,
                            options: assignable.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
                          },
                        ]}
                      />
                    ) : (
                      <>
                        {ROLE_LABELS[u.role]}
                        {self && (
                          <span className="block text-xs text-ink-soft">
                            You can&apos;t change your own role
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {canRevoke && !self && (
                      <ActionButton
                        action={revokeSessionsAction}
                        payload={{ uid: u.uid }}
                        confirm={`Sign ${u.email} out everywhere?`}
                        done="Signed out"
                      >
                        Sign out everywhere
                      </ActionButton>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 && <p className="p-6 text-sm text-ink-soft">No accounts match.</p>}
      </div>

      {hasPermission(session.role, "users.invite") && (
        <Panel title="Invite staff">
          <ActionForm
            action={inviteStaffAction}
            submitLabel="Send invitation"
            done="Invitation sent"
            layout="inline"
            fields={[
              { name: "email", label: "Email", type: "email", required: true },
              { name: "firstName", label: "First name", type: "text", required: true },
              { name: "lastName", label: "Last name", type: "text", required: true },
              {
                name: "role",
                label: "Role",
                type: "select",
                required: true,
                options: STAFF_ROLES.filter(
                  (r) => session.role === "super_admin" || !isOwnerOnlyRole(r),
                ).map((r) => ({ value: r, label: ROLE_LABELS[r] })),
              },
            ]}
          />
        </Panel>
      )}
    </div>
  );
}

/** Users and roles: staff list, role changes, session revocation and invitations. */
export default function Page(props: PageProps<"/admin/users">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <Users {...props} />
    </Suspense>
  );
}
