import { render, screen } from "@testing-library/react";
import { Textarea } from "./Textarea";

describe("Textarea", () => {
  it("is labelled and describes its error", () => {
    render(<Textarea label="Message" error="Tell us a little more" />);
    const field = screen.getByRole("textbox", { name: "Message" });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Tell us a little more");
  });

  it("shows a character count when asked", () => {
    render(
      <Textarea label="Message" maxLength={300} showCount value="Hello" onChange={() => {}} />,
    );
    expect(screen.getByText("5/300")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("maxlength", "300");
  });

  it("does not grow to a fixed control height", () => {
    render(<Textarea label="Message" />);
    expect(screen.getByRole("textbox")).toHaveClass("h-auto");
    expect(screen.getByRole("textbox")).not.toHaveClass("h-12");
  });
});
