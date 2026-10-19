import { fireEvent, render, screen } from "@testing-library/react";
import { Checkbox } from "./Checkbox";
import { Radio, RadioGroup } from "./Radio";

describe("Checkbox", () => {
  it("toggles when its label is clicked", () => {
    render(<Checkbox label="Email me about new arrivals" />);
    const checkbox = screen.getByRole("checkbox", { name: "Email me about new arrivals" });
    fireEvent.click(screen.getByText("Email me about new arrivals"));
    expect(checkbox).toBeChecked();
  });

  it("describes errors and marks invalid", () => {
    render(<Checkbox label="Accept the terms" error="You must accept the terms" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(checkbox).toHaveAccessibleDescription("You must accept the terms");
  });

  it("can be disabled", () => {
    render(<Checkbox label="Gift wrap" disabled />);
    expect(screen.getByRole("checkbox", { name: "Gift wrap" })).toBeDisabled();
  });
});

describe("RadioGroup", () => {
  it("groups radios under one accessible name and allows one choice", () => {
    render(
      <RadioGroup legend="Delivery method">
        <Radio name="delivery" value="standard" label="Standard" />
        <Radio name="delivery" value="express" label="Express" />
      </RadioGroup>,
    );
    expect(screen.getByRole("radiogroup", { name: "Delivery method" })).toBeInTheDocument();

    const standard = screen.getByRole("radio", { name: "Standard" });
    const express = screen.getByRole("radio", { name: "Express" });
    fireEvent.click(standard);
    fireEvent.click(express);
    expect(express).toBeChecked();
    expect(standard).not.toBeChecked();
  });

  it("marks the group required", () => {
    render(
      <RadioGroup legend="Delivery method" required>
        <Radio name="delivery" value="standard" label="Standard" />
      </RadioGroup>,
    );
    expect(screen.getByRole("radiogroup")).toHaveAttribute("aria-required", "true");
  });

  it("describes the group with its error", () => {
    render(
      <RadioGroup legend="Delivery method" error="Choose a delivery method">
        <Radio name="delivery" value="standard" label="Standard" />
      </RadioGroup>,
    );
    const group = screen.getByRole("radiogroup", { name: "Delivery method" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription("Choose a delivery method");
  });
});
