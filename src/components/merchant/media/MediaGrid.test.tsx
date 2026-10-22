import { fireEvent, render, screen } from "@testing-library/react";
import { MediaGrid, moveItem, type GridImage } from "./MediaGrid";

const images: GridImage[] = ["a", "b", "c"].map((id) => ({
  mediaId: id,
  url: `/media/m/v/s/${id}.webp`,
  alt: `Image ${id}`,
  width: 1200,
  height: 1600,
}));

describe("moveItem", () => {
  it("moves items and ignores out-of-range moves", () => {
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(moveItem([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 0, 5)).toEqual([1, 2, 3]);
  });
});

describe("MediaGrid", () => {
  it("labels main and hover images and reorders with buttons", () => {
    const onReorder = vi.fn();
    render(
      <MediaGrid images={images} onReorder={onReorder} onRemove={() => {}} label="Navy photos" />,
    );
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Hover")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move image 1 earlier" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move image 3 later" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Move image 2 earlier" }));
    expect(onReorder).toHaveBeenCalledWith([images[1], images[0], images[2]]);
    expect(screen.getByText("Moved to position 1 of 3")).toBeInTheDocument();
  });

  it("removes an image", () => {
    const onRemove = vi.fn();
    render(<MediaGrid images={images} onReorder={() => {}} onRemove={onRemove} label="Photos" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove image 3" }));
    expect(onRemove).toHaveBeenCalledWith("c");
  });
});
