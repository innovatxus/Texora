// @vitest-environment node
import sharp from "sharp";
import { MediaRejectedError, processUpload } from "./process";
import { videoDurationSeconds } from "./video";

/** A solid-colour image of the given size and format, optionally with EXIF (camera + GPS). */
async function image(
  width: number,
  height: number,
  format: "jpeg" | "png" | "webp" = "jpeg",
  { exif = false, orientation }: { exif?: boolean; orientation?: number } = {},
): Promise<Uint8Array> {
  let pipeline = sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 60, b: 40 } },
  })[format]();
  if (exif || orientation) {
    pipeline = pipeline.withMetadata({
      ...(orientation ? { orientation } : {}),
      ...(exif
        ? {
            exif: {
              IFD0: { Make: "TestCam", Model: "X100", Copyright: "Ada" },
              IFD3: { GPSLatitudeRef: "N", GPSLatitude: "40/1 44/1 0/1" },
            },
          }
        : {}),
    });
  }
  return new Uint8Array(await pipeline.toBuffer());
}

const reason = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return null;
  } catch (error) {
    expect(error).toBeInstanceOf(MediaRejectedError);
    return (error as Error).message;
  }
};

describe("processUpload: images", () => {
  it("re-encodes a logo as a square WebP with a placeholder and dominant colour", async () => {
    const result = await processUpload("logo", await image(900, 600, "png"));
    expect(result.type).toBe("image");
    if (result.type !== "image") return;
    expect(result.contentType).toBe("image/webp");
    expect(result.width).toBe(result.height);
    expect(result.width).toBe(600);
    expect(result.blurDataURL).toMatch(/^data:image\/webp;base64,/);
    expect(result.dominantColor).toMatch(/^#[0-9a-f]{6}$/);
    expect((await sharp(result.buffer).metadata()).format).toBe("webp");
  });

  it("strips EXIF and GPS metadata", async () => {
    const input = await image(1800, 2400, "jpeg", { exif: true });
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const result = await processUpload("productImage", input);
    const meta = await sharp(result.buffer).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(result.buffer.includes(Buffer.from("TestCam"))).toBe(false);
  });

  it("applies the EXIF orientation before cropping", async () => {
    // Stored landscape, displayed portrait (orientation 6 = rotate 90°).
    const input = await image(2400, 1800, "jpeg", { orientation: 6 });
    const result = await processUpload("productImage", input);
    if (result.type !== "image") throw new Error("expected an image");
    expect(result.height).toBeGreaterThan(result.width);
  });

  it("applies the requested crop", async () => {
    const result = await processUpload("banner", await image(3000, 1500, "webp"), {
      crop: { x: 0, y: 0.25, width: 1, height: 2 / 3 },
    });
    if (result.type !== "image") throw new Error("expected an image");
    expect(result.width / result.height).toBeCloseTo(3, 1);
  });

  it("refuses images below the minimum size", async () => {
    expect(await reason(processUpload("logo", await image(300, 300, "png")))).toBe(
      "Your logo is 300×300 px — use at least 512×512 px.",
    );
    expect(await reason(processUpload("productImage", await image(1000, 1200)))).toBe(
      "That photo is 1000×1200 px — use at least 1600 px on the long edge.",
    );
  });

  it("refuses oversized files before decoding them", async () => {
    const big = new Uint8Array(6 * 1024 * 1024);
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(await reason(processUpload("logo", big))).toBe("That file is 6 MB — the limit is 5 MB.");
  });
});

describe("processUpload: hostile files", () => {
  it("refuses HTML renamed as an image", async () => {
    const html = new TextEncoder().encode("<!doctype html><script>alert(document.cookie)</script>");
    expect(await reason(processUpload("logo", html))).toMatch(/^That file type isn't supported/);
  });

  it("refuses SVGs with scripts, handlers or external references", async () => {
    const svg = (body: string) =>
      new TextEncoder().encode(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${body}</svg>`,
      );
    expect(await reason(processUpload("logo", svg("<script>alert(1)</script>")))).toBe(
      "That SVG contains a script, which isn't allowed. Export it as plain artwork, or upload a PNG.",
    );
    expect(
      await reason(processUpload("logo", svg('<rect width="10" height="10" onclick="x()"/>'))),
    ).toMatch(/event handler/);
    expect(
      await reason(processUpload("logo", svg('<image href="https://evil.example/p.png"/>'))),
    ).toMatch(/external reference/);
  });

  it("rasterises a clean SVG logo, so no SVG is ever served", async () => {
    const clean = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#1f2a44"/></svg>',
    );
    const result = await processUpload("logo", clean);
    if (result.type !== "image") throw new Error("expected an image");
    expect(result.contentType).toBe("image/webp");
    expect(result.width).toBe(result.height);
    expect(result.width).toBeGreaterThanOrEqual(256);
  });

  it("refuses SVG banners (logos only)", async () => {
    const clean = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(await reason(processUpload("banner", clean))).toMatch(/^That file type isn't supported/);
  });

  it("refuses corrupt image data", async () => {
    const corrupt = new Uint8Array(4096);
    corrupt.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(await reason(processUpload("productImage", corrupt))).toBe(
      "We couldn't use that file. Try saving it again as PNG or JPG.",
    );
  });
});

describe("video", () => {
  /** A minimal MP4 header: ftyp + moov/mvhd (version 0) with a timescale and duration. */
  function mp4(seconds: number): Uint8Array {
    const bytes = new Uint8Array(128);
    const view = new DataView(bytes.buffer);
    bytes.set(new TextEncoder().encode("\u0000\u0000\u0000\u0018ftypisom"), 0);
    const at = 24;
    view.setUint32(at, 108);
    bytes.set(new TextEncoder().encode("moov"), at + 4);
    view.setUint32(at + 8, 100);
    bytes.set(new TextEncoder().encode("mvhd"), at + 12);
    // version 0, flags, creation, modification, timescale, duration
    view.setUint32(at + 28, 1000);
    view.setUint32(at + 32, Math.round(seconds * 1000));
    return bytes;
  }

  it("reads MP4 duration from the header", () => {
    expect(videoDurationSeconds(mp4(12.5), "video/mp4")).toBeCloseTo(12.5);
    expect(videoDurationSeconds(new Uint8Array(64), "video/mp4")).toBeNull();
  });

  it("reads WebM duration (default timecode scale)", () => {
    const bytes = new Uint8Array(32);
    bytes.set([0x1a, 0x45, 0xdf, 0xa3]);
    bytes.set([0x44, 0x89, 0x84], 10); // Duration, 4-byte float
    new DataView(bytes.buffer).setFloat32(13, 8000); // 8000 ticks × 1ms
    expect(videoDurationSeconds(bytes, "video/webm")).toBeCloseTo(8);
  });

  it("accepts short videos and refuses long ones", async () => {
    const ok = await processUpload("productVideo", mp4(20));
    expect(ok).toMatchObject({ type: "video", contentType: "video/mp4", durationSeconds: 20 });
    expect(await reason(processUpload("productVideo", mp4(45)))).toBe(
      "That video is 45 seconds — keep it to 30 seconds.",
    );
  });
});
