import { fireEvent, render, screen } from "@testing-library/react";
import { Button, ButtonLink } from "./Button";

describe("Button", () => {
  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Add to bag</Button>);
    expect(screen.getByRole("button", { name: "Add to bag" })).toHaveAttribute("type", "button");
  });

  it("fires onClick when enabled", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add to bag</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("blocks interaction and keeps its accessible name while loading", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Place order
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Place order" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("merges a className override over variant classes", () => {
    render(
      <Button size="sm" className="px-10">
        Shop
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button.className).toContain("px-10");
    expect(button.className).not.toContain("px-4");
  });
});

describe("ButtonLink", () => {
  it("renders a link with button styling", () => {
    render(<ButtonLink href="/women">Shop women</ButtonLink>);
    const link = screen.getByRole("link", { name: "Shop women" });
    expect(link).toHaveAttribute("href", "/women");
    expect(link.className).toContain("bg-ink");
  });
});
