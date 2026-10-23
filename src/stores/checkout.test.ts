import { firstIncompleteStep } from "./checkout";

const address = {
  firstName: "A",
  lastName: "B",
  line1: "1 Main",
  city: "Zamalek",
  region: "C",
  postalCode: "11211",
  country: "EG" as const,
  phone: "01012345678",
};

describe("firstIncompleteStep", () => {
  it("walks the steps in order", () => {
    expect(
      firstIncompleteStep({
        email: null,
        shippingAddress: null,
        delivery: null,
        paymentMethod: null,
      }),
    ).toBe("contact");
    expect(
      firstIncompleteStep({
        email: "a@b.co",
        shippingAddress: null,
        delivery: null,
        paymentMethod: null,
      }),
    ).toBe("shipping");
    expect(
      firstIncompleteStep({
        email: "a@b.co",
        shippingAddress: address,
        delivery: null,
        paymentMethod: null,
      }),
    ).toBe("delivery");
    expect(
      firstIncompleteStep({
        email: "a@b.co",
        shippingAddress: address,
        delivery: { method: "standard" },
        paymentMethod: null,
      }),
    ).toBe("payment");
    expect(
      firstIncompleteStep({
        email: "a@b.co",
        shippingAddress: address,
        delivery: { method: "standard" },
        paymentMethod: "cod",
      }),
    ).toBe("review");
  });
});
