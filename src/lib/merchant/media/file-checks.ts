/** Browser-side checks on a picked file, before anything is uploaded. */
import type { MediaKind } from "@/config/merchant";
import { dimensionProblem, fileProblem } from "./rules";

/** Natural size of an image file, or null when the browser can't decode it (or it's SVG). */
export async function readImageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (file.type === "image/svg+xml") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

/** The client-side check: type, size and dimensions. The server checks all of it again. */
export async function checkFile(kind: MediaKind, file: File): Promise<string | null> {
  const basic = fileProblem(kind, file.type, file.size);
  if (basic) return basic;
  if (kind === "productVideo") return null;
  const size = await readImageSize(file);
  if (!size)
    return file.type === "image/svg+xml" ? null : "We couldn't open that image. Try another file.";
  return dimensionProblem(kind, size.width, size.height, file.type);
}
