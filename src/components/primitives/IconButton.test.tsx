import { render, screen } from "@testing-library/react";
import { CloseIcon } from "@/components/icons";
import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("uses its label as the accessible name and hides the icon", () => {
    const { container } = render(<IconButton label="Close" icon={<CloseIcon />} />);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("is disabled and busy while loading", () => {
    render(<IconButton label="Save" icon={<CloseIcon />} loading />);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
