import { render, screen } from "@testing-library/react";
import { HeartIcon, iconCatalog, SearchIcon } from ".";

describe("Icon", () => {
  it("is decorative by default", () => {
    const { container } = render(<SearchIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
  });

  it("exposes an accessible name when labelled", () => {
    render(<SearchIcon label="Search" />);
    expect(screen.getByRole("img", { name: "Search" })).toBeInTheDocument();
  });

  it("renders at 20px by default and 24px on request", () => {
    const { container, rerender } = render(<SearchIcon />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "20");
    rerender(<SearchIcon size={24} />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "24");
  });

  it("fills the heart only when filled", () => {
    const { container, rerender } = render(<HeartIcon />);
    expect(container.querySelector("path")).toHaveAttribute("fill", "none");
    rerender(<HeartIcon filled />);
    expect(container.querySelector("path")).toHaveAttribute("fill", "currentColor");
  });

  it("covers the full icon set from the brief", () => {
    const required = [
      "search",
      "bag",
      "heart",
      "account",
      "store",
      "close",
      "chevron-down",
      "chevron-up",
      "chevron-left",
      "chevron-right",
      "plus",
      "minus",
      "filter",
      "zoom",
      "truck",
      "return",
      "check",
    ];
    expect(Object.keys(iconCatalog)).toEqual(expect.arrayContaining(required));
  });
});
