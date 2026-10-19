import { render, screen } from "@testing-library/react";
import { Input } from "./Input";
import { Select } from "./Select";

describe("Input", () => {
  it("associates the label with the input", () => {
    render(<Input label="Email" type="email" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
  });

  it("is not described or invalid without hint or error", () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText("Email");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("links hint and error text and marks the field invalid", () => {
    render(
      <Input label="Postcode" hint="Used for delivery estimates" error="Enter a valid postcode" />,
    );
    const input = screen.getByLabelText("Postcode");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Used for delivery estimates Enter a valid postcode");
  });

  it("keeps a visually hidden label accessible", () => {
    render(<Input label="Search" hideLabel />);
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
    expect(screen.getByText("Search")).toHaveClass("sr-only");
  });

  it("uses a supplied id", () => {
    render(<Input id="checkout-email" label="Email" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("id", "checkout-email");
  });
});

describe("Select", () => {
  const options = [
    { value: "s", label: "Small" },
    { value: "m", label: "Medium" },
    { value: "l", label: "Large", disabled: true },
  ];

  it("renders options with a disabled placeholder", () => {
    render(<Select label="Size" options={options} placeholder="Choose a size" defaultValue="" />);
    const select = screen.getByLabelText("Size");
    expect(select).toHaveDisplayValue("Choose a size");
    expect(screen.getByRole("option", { name: "Choose a size" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Large" })).toBeDisabled();
  });

  it("links an error message", () => {
    render(<Select label="Size" options={options} error="Select a size" />);
    expect(screen.getByLabelText("Size")).toHaveAccessibleDescription("Select a size");
  });
});
