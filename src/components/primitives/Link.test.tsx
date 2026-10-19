import { render, screen } from "@testing-library/react";
import { Link } from "./Link";

describe("Link", () => {
  it("renders internal links in the same tab", () => {
    render(<Link href="/help">Help</Link>);
    const link = screen.getByRole("link", { name: "Help" });
    expect(link).not.toHaveAttribute("target");
  });

  it("opens absolute URLs in a new tab and announces it", () => {
    render(<Link href="https://example.com">Partner</Link>);
    // jsdom has no layout, so it joins inline text without the space a browser keeps.
    const link = screen.getByRole("link", { name: /^Partner\s?\(opens in a new tab\)$/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("lets callers opt out of the new tab", () => {
    render(
      <Link href="https://example.com" external={false}>
        Partner
      </Link>,
    );
    expect(screen.getByRole("link", { name: "Partner" })).not.toHaveAttribute("target");
  });
});
