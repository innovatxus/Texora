import type { Order } from "@/lib/validation/commerce";
import { merchantOrderView, statusAfterShipment } from "./orders";

const line = (sku: string, vendorId?: string, quantity = 1) =>
  ({
    sku,
    productId: `p-${sku}`,
    name: sku,
    colorName: "Navy",
    size: "M",
    fitFamily: "regular",
    imageUrl: "",
    unitPrice: 5000,
    quantity,
    discount: 0,
    lineTotal: 5000 * quantity,
    finalSale: false,
    ...(vendorId ? { vendorId, shopId: `s-${vendorId}`, shopName: `Shop ${vendorId}` } : {}),
  }) as Order["lines"][number];

const order = (over: Partial<Order> = {}): Order =>
  ({
    id: "o1",
    number: "TX-100900",
    status: "placed",
    vendorIds: ["v1", "v2"],
    placedAt: new Date("2026-10-21T10:00:00Z"),
    lines: [line("TX-OWN"), line("V1-A", "v1", 2), line("V1-B", "v1"), line("V2-A", "v2")],
    shipments: [],
    shippingAddress: {
      firstName: "Ada",
      lastName: "L",
      line1: "1 St",
      city: "Zamalek",
      region: "C",
      postalCode: "11211",
      country: "EG",
    },
    delivery: { method: "standard" },
    payments: [{ provider: "paymob", ref: "1001", amount: 1, status: "captured" }],
    ...over,
  }) as unknown as Order;

describe("merchantOrderView", () => {
  it("shows only the merchant's lines and totals, never payments", () => {
    const view = merchantOrderView(order(), "v1");
    expect(view?.lines.map((l) => l.sku)).toEqual(["V1-A", "V1-B"]);
    expect(view).toMatchObject({
      items: 3,
      total: 15000,
      status: "to_ship",
      unshipped: ["V1-A", "V1-B"],
    });
    expect(view && "payments" in view).toBe(false);
  });

  it("returns nothing for a merchant without lines", () => {
    expect(merchantOrderView(order(), "v3")).toBeNull();
  });

  it("follows the merchant's own parcels", () => {
    const shipped = order({
      status: "partially_shipped",
      shipments: [
        {
          id: "s1",
          carrier: "UPS",
          trackingNumber: "1Z",
          skus: ["V1-A", "V1-B"],
          status: "in_transit",
        },
        { id: "s2", carrier: "USPS", trackingNumber: "94", skus: ["V2-A"], status: "delivered" },
      ],
    });
    expect(merchantOrderView(shipped, "v1")).toMatchObject({ status: "shipped", unshipped: [] });
    expect(merchantOrderView(shipped, "v1")?.shipments.map((s) => s.id)).toEqual(["s1"]);
    expect(merchantOrderView(shipped, "v2")?.status).toBe("delivered");
    const partly = order({
      shipments: [
        { id: "s1", carrier: "UPS", trackingNumber: "1Z", skus: ["V1-A"], status: "in_transit" },
      ],
    });
    expect(merchantOrderView(partly, "v1")).toMatchObject({
      status: "partly_shipped",
      unshipped: ["V1-B"],
    });
    expect(merchantOrderView(order({ status: "cancelled" }), "v1")?.status).toBe("cancelled");
  });
});

describe("statusAfterShipment", () => {
  it("is shipped only when every seller's lines are in a parcel", () => {
    expect(statusAfterShipment(order(), ["V1-A", "V1-B"])).toBe("partially_shipped");
    expect(
      statusAfterShipment(order({ shipments: [{ skus: ["TX-OWN", "V2-A"] } as never] }), [
        "V1-A",
        "V1-B",
      ]),
    ).toBe("shipped");
  });
});
