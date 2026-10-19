"use client";

import { useRef, useState } from "react";
import { ProductImage } from "@/components/commerce/ProductImage";
import { ZoomIcon } from "@/components/icons";
import { cn } from "@/lib/utils/cn";
import { ZoomViewer, type GalleryImage } from "./ZoomViewer";

/**
 * Desktop: two-column image stack. Mobile: full-width swipe carousel with dots
 * and a counter. Any image opens the zoom viewer at that image.
 */
export function Gallery({
  images,
  productName,
}: {
  images: readonly GalleryImage[];
  productName: string;
}) {
  const [zoomIndex, setZoomIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  const openZoom = (i: number) => {
    setZoomIndex(i);
    setZoomOpen(true);
  };

  return (
    <div>
      {/* Mobile carousel */}
      <div className="relative -mx-4 md:-mx-6 lg:hidden">
        <div
          ref={track}
          onScroll={(e) =>
            setSlide(
              Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)),
            )
          }
          className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden"
          aria-label={`${productName} images`}
          role="region"
          aria-roledescription="carousel"
        >
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => openZoom(i)}
              aria-label={`Zoom image ${i + 1} of ${images.length}`}
              className="relative aspect-3/4 w-full shrink-0 snap-start"
            >
              <ProductImage src={img.url} alt={img.alt} fill sizes="100vw" priority={i === 0} />
            </button>
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5"
          aria-hidden
        >
          {images.map((img, i) => (
            <span
              key={img.url}
              className={cn("size-1.5 rounded-full", i === slide ? "bg-ink" : "bg-ink/30")}
            />
          ))}
        </div>
        <p
          className="absolute top-3 right-3 bg-surface/90 px-2 py-1 text-xs tabular-nums"
          aria-live="polite"
        >
          {slide + 1} / {images.length}
        </p>
      </div>

      {/* Desktop stack */}
      <ul className="hidden grid-cols-2 gap-2 lg:grid">
        {images.map((img, i) => (
          <li
            key={img.url}
            className={cn(images.length % 2 === 1 && i === images.length - 1 && "col-span-2")}
          >
            <button
              type="button"
              onClick={() => openZoom(i)}
              aria-label={`Zoom image ${i + 1} of ${images.length}`}
              className={cn(
                "group relative block w-full cursor-zoom-in",
                images.length % 2 === 1 && i === images.length - 1 ? "aspect-3/2" : "aspect-3/4",
              )}
            >
              <ProductImage
                src={img.url}
                alt={img.alt}
                fill
                sizes="(min-width: 1024px) 30vw, 100vw"
                priority={i < 2}
              />
              <span className="absolute right-3 bottom-3 flex size-10 items-center justify-center bg-surface/90 opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-visible:opacity-100">
                <ZoomIcon />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <ZoomViewer
        images={images}
        index={zoomIndex}
        open={zoomOpen}
        onOpenChange={setZoomOpen}
        onIndexChange={setZoomIndex}
        productName={productName}
      />
    </div>
  );
}
