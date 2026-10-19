import { sessionFromClaims } from "./session";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/firebase/admin", () => ({ getFirebaseAdmin: vi.fn() }));

describe("sessionFromClaims", () => {
  it("defaults a missing role claim to customer", () => {
    expect(sessionFromClaims({ uid: "u1", email: "a@b.co" })).toEqual({
      uid: "u1",
      email: "a@b.co",
      role: "customer",
      vendorId: null,
    });
  });

  it("keeps a valid role and vendor id", () => {
    expect(sessionFromClaims({ uid: "u1", role: "vendor", vendorId: "v1" })).toMatchObject({
      role: "vendor",
      vendorId: "v1",
    });
  });

  it("downgrades an unrecognised role claim to guest (no permissions)", () => {
    expect(sessionFromClaims({ uid: "u1", role: "owner" }).role).toBe("guest");
    expect(sessionFromClaims({ uid: "u1", role: 7 }).role).toBe("guest");
  });
});
