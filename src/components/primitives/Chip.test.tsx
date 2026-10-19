import { fireEvent, render, screen } from "@testing-library/react";
import { Chip } from "./Chip";

describe("Chip", () => {
  it("exposes toggle state through aria-pressed", () => {
    const { rerender } = render(<Chip label="Petite" selected={false} />);
    expect(screen.getByRole("button", { name: "Petite" })).toHaveAttribute("aria-pressed", "false");
    rerender(<Chip label="Petite" selected />);
    expect(screen.getByRole("button", { name: "Petite" })).toHaveAttribute("aria-pressed", "true");
  });

  it("names the remove action for dismissible chips", () => {
    const onClick = vi.fn();
    render(<Chip variant="dismissible" label="Size: M" onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Remove Size: M" });
    expect(button).not.toHaveAttribute("aria-pressed");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("accepts a custom remove label", () => {
    render(<Chip variant="dismissible" label="Navy" removeLabel="Remove colour filter Navy" />);
    expect(screen.getByRole("button", { name: "Remove colour filter Navy" })).toBeInTheDocument();
  });
});
