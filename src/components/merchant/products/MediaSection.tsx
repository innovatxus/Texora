"use client";

import { useEffect, useRef } from "react";
import { Input, Select } from "@/components/primitives";
import { FocalPointPicker } from "@/components/merchant/media/FocalPointPicker";
import { MediaGrid } from "@/components/merchant/media/MediaGrid";
import { Uploader } from "@/components/merchant/media/Uploader";
import { UploadQueue } from "@/components/merchant/media/UploadQueue";
import { MERCHANT_LIMITS } from "@/config/merchant";
import { suggestAlt } from "@/lib/merchant/editor";
import type { DraftColor, DraftImage } from "@/lib/validation/merchant";
import { onUploadDone } from "@/stores/uploads";
import type { SectionProps } from "./types";

const L = MERCHANT_LIMITS.productImage;

/**
 * Photos per colour: 1–12 images (first = main, second = hover), each with
 * alt text the merchant must confirm, a focal point, reordering with button
 * equivalents, "copy from another colour" and an optional short video. The
 * upload queue keeps going while the merchant moves between sections.
 */
export function MediaSection({ data, update, context, errors }: SectionProps) {
  const productName = useRef(data.name);
  useEffect(() => {
    productName.current = data.name;
  }, [data.name]);

  // One listener per colour: finished uploads are appended to that colour.
  const codes = data.colors.map((c) => c.code).join(",");
  useEffect(() => {
    const offs = codes
      .split(",")
      .filter(Boolean)
      .map((code) =>
        onUploadDone(`product:${context.productId}:${code}`, (item) => {
          const result = item.result;
          if (!result) return;
          update((current) => ({
            colors: current.colors.map((color) => {
              if (color.code !== code) return color;
              if (result.kind === "video") {
                return {
                  ...color,
                  video: {
                    mediaId: result.media.id,
                    url: result.url,
                    durationSeconds: result.media.durationSeconds ?? 1,
                  },
                };
              }
              if (color.images.length >= L.maxPerColor) return color;
              const image: DraftImage = {
                ...result.image,
                alt: suggestAlt(productName.current, color.name, color.images.length),
                altConfirmed: false,
              };
              return { ...color, images: [...color.images, image] };
            }),
          }));
        }),
      );
    return () => offs.forEach((off) => off());
  }, [codes, context.productId, update]);

  const patchColor = (code: string, patch: (c: DraftColor) => Partial<DraftColor>) =>
    update((current) => ({
      colors: current.colors.map((c) => (c.code === code ? { ...c, ...patch(c) } : c)),
    }));

  if (data.colors.length === 0) {
    return <p className="text-sm text-ink-soft">Add a colour in Options to upload its photos.</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      {data.colors.map((color) => {
        const ownerKey = `product:${context.productId}:${color.code}`;
        const others = data.colors.filter((c) => c.code !== color.code && c.images.length > 0);
        return (
          <section
            key={color.code}
            id={`field-media-${color.code}`}
            tabIndex={-1}
            aria-labelledby={`media-${color.code}`}
            className="flex flex-col gap-4"
          >
            <h3 id={`media-${color.code}`} className="flex items-center gap-3 font-medium">
              <span
                aria-hidden="true"
                className="size-5 border border-line"
                style={{ background: color.swatch }}
              />
              {color.name || "Unnamed colour"} · {color.images.length}/{L.maxPerColor} photos
            </h3>
            {errors[`field-media-${color.code}`] && (
              <p className="text-sm text-sale">{errors[`field-media-${color.code}`]}</p>
            )}

            <MediaGrid
              label={`${color.name} photos`}
              images={color.images}
              onReorder={(next) =>
                patchColor(color.code, () => ({
                  images: next.map(
                    (g) => color.images.find((i) => i.mediaId === g.mediaId) as DraftImage,
                  ),
                }))
              }
              onRemove={(mediaId) =>
                patchColor(color.code, (c) => ({
                  images: c.images.filter((i) => i.mediaId !== mediaId),
                }))
              }
            />

            {color.images.length > 0 && (
              <details className="border border-line bg-surface p-3">
                <summary className="min-h-11 cursor-pointer content-center font-medium">
                  Alt text and focal points
                  {color.images.some((i) => !i.altConfirmed) && (
                    <span className="ml-2 text-sm font-normal text-sale">
                      {color.images.filter((i) => !i.altConfirmed).length} to check
                    </span>
                  )}
                </summary>
                <ol className="mt-3 flex flex-col gap-6">
                  {color.images.map((image, index) => (
                    <li key={image.mediaId} className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                      <FocalPointPicker
                        src={image.url}
                        width={image.width}
                        height={image.height}
                        value={image.focal ?? { x: 0.5, y: 0.5 }}
                        onChange={(focal) =>
                          patchColor(color.code, (c) => ({
                            images: c.images.map((i) =>
                              i.mediaId === image.mediaId ? { ...i, focal } : i,
                            ),
                          }))
                        }
                        label={`Focal point, image ${index + 1}`}
                      />
                      <div className="flex flex-col gap-3">
                        <Input
                          label={`Alt text, image ${index + 1}`}
                          maxLength={200}
                          hint={
                            image.altConfirmed
                              ? "Describes the photo for people using screen readers."
                              : "Check this description — confirm or edit it."
                          }
                          value={image.alt}
                          error={image.alt.trim() ? undefined : "Add a short description"}
                          onChange={(e) =>
                            patchColor(color.code, (c) => ({
                              images: c.images.map((i) =>
                                i.mediaId === image.mediaId
                                  ? { ...i, alt: e.target.value, altConfirmed: true }
                                  : i,
                              ),
                            }))
                          }
                        />
                        <label className="flex min-h-11 items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="size-5 accent-ink"
                            checked={image.altConfirmed}
                            onChange={(e) =>
                              patchColor(color.code, (c) => ({
                                images: c.images.map((i) =>
                                  i.mediaId === image.mediaId
                                    ? { ...i, altConfirmed: e.target.checked }
                                    : i,
                                ),
                              }))
                            }
                          />
                          This description is right
                        </label>
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
            )}

            {color.images.length < L.maxPerColor && (
              <Uploader
                kind="productImage"
                shopId={context.shop.id}
                ownerKey={ownerKey}
                multiple
                instructions={`Add 1–${L.maxPerColor} photos of ${color.name || "this colour"}. At least ${L.minLongEdge} px on the long edge, 3:4 portrait works best, up to 15 MB.`}
              />
            )}
            <UploadQueue ownerKey={ownerKey} />

            {others.length > 0 && (
              <Select
                label="Copy images from another colour"
                placeholder="Choose a colour"
                options={others.map((c) => ({
                  value: c.code,
                  label: `${c.name} (${c.images.length})`,
                }))}
                value=""
                onChange={(e) => {
                  const source = data.colors.find((c) => c.code === e.target.value);
                  if (!source) return;
                  patchColor(color.code, (c) => ({
                    images: [
                      ...c.images,
                      ...source.images
                        .filter((i) => !c.images.some((x) => x.mediaId === i.mediaId))
                        .map((i, n) => ({
                          ...i,
                          alt: suggestAlt(data.name, c.name, c.images.length + n),
                          altConfirmed: false,
                        })),
                    ].slice(0, L.maxPerColor),
                  }));
                }}
              />
            )}

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Video (optional, up to 30 seconds)</p>
              {color.video ? (
                <div className="flex flex-wrap items-center gap-4">
                  <a
                    href={color.video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-11 content-center text-sm underline underline-offset-4"
                  >
                    Watch video ({Math.round(color.video.durationSeconds)}s)
                    <span className="sr-only"> for {color.name}, opens in a new tab</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => patchColor(color.code, () => ({ video: undefined }))}
                    className="min-h-11 text-sm underline underline-offset-4"
                  >
                    Remove video<span className="sr-only"> for {color.name}</span>
                  </button>
                </div>
              ) : (
                <Uploader
                  kind="productVideo"
                  shopId={context.shop.id}
                  ownerKey={ownerKey}
                  instructions="MP4 or WebM, up to 30 seconds and 100 MB."
                />
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
