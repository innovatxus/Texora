import { render, screen } from "@testing-library/react";
import { PriceDisplay } from "./PriceDisplay";

describe("PriceDisplay", () => {
  it("shows a regular price", () => {
    render(<PriceDisplay price={12800} />);
    expect(screen.getByText("$128.00")).toBeInTheDocument();
  });

  it("shows sale, original and percent off with screen-reader labels", () => {
    const { container } = render(<PriceDisplay price={8960} compareAtPrice={12800} />);
    expect(container).toHaveTextContent("Sale price $89.60");
    expect(container).toHaveTextContent("Original price $128.00");
    expect(screen.getByText("30% off")).toBeInTheDocument();
    expect(container.querySelector("s")).toHaveTextContent("$128.00");
  });

  it("shows a price range", () => {
    render(<PriceDisplay price={4800} max={6800} />);
    expect(screen.getByText("$48.00 – $68.00")).toBeInTheDocument();
  });

  it("hides the percent label on request", () => {
    render(<PriceDisplay price={8960} compareAtPrice={12800} showPercent={false} />);
    expect(screen.queryByText("30% off")).not.toBeInTheDocument();
  });
});
