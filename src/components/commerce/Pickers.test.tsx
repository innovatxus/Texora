import { fireEvent, render, screen } from "@testing-library/react";
import { FitTabs, QuantityStepper, SizePicker, SwatchPicker } from "./Pickers";

describe("SwatchPicker", () => {
  it("is a named radio group and reports the choice", () => {
    const onChange = vi.fn();
    render(
      <SwatchPicker
        name="c"
        value="navy"
        onChange={onChange}
        options={[
          { value: "navy", label: "Navy", swatch: "#000" },
          { value: "oat", label: "Oat", swatch: "#eee" },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: /Colour/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Navy" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Oat" }));
    expect(onChange).toHaveBeenCalledWith("oat");
  });
});

describe("SizePicker", () => {
  it("keeps out-of-stock sizes selectable and labelled", () => {
    const onChange = vi.fn();
    render(
      <SizePicker
        name="s"
        value={null}
        onChange={onChange}
        options={[
          { size: "S", inStock: false },
          { size: "M", inStock: true },
        ]}
      />,
    );
    // jsdom joins inline text without the space a browser keeps.
    const small = screen.getByRole("radio", { name: /^S\s?\(out of stock, notify me\)$/ });
    expect(small).toBeEnabled();
    fireEvent.click(small);
    expect(onChange).toHaveBeenCalledWith("S");
  });

  it("announces a size error", () => {
    render(
      <SizePicker
        name="s"
        value={null}
        onChange={() => {}}
        options={[{ size: "M", inStock: true }]}
        error="Select a size"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Select a size");
    expect(screen.getByRole("group")).toHaveAccessibleDescription("Select a size");
  });
});

describe("FitTabs", () => {
  it("hides itself when only one fit exists", () => {
    const { container } = render(
      <FitTabs name="f" fits={["regular"]} value="regular" onChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("QuantityStepper", () => {
  it("clamps between min and max", () => {
    const onChange = vi.fn();
    const { rerender } = render(<QuantityStepper value={1} onChange={onChange} max={3} />);
    expect(screen.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity" }));
    expect(onChange).toHaveBeenCalledWith(2);
    rerender(<QuantityStepper value={3} onChange={onChange} max={3} />);
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "9" } });
    expect(onChange).toHaveBeenLastCalledWith(3);
  });
});
