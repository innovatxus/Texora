import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils/cn";

export interface ProductImageProps extends Omit<ImageProps, "alt"> {
  alt: string;
}

/**
 * Product and editorial imagery. Sharp corners, muted placeholder colour while
 * loading. SVG placeholders skip the optimiser (they are already vector).
 */
export function ProductImage({ src, alt, className, ...props }: ProductImageProps) {
  const isSvg = typeof src === "string" && src.endsWith(".svg");
  return (
    <Image
      src={src}
      alt={alt}
      unoptimized={isSvg}
      className={cn("rounded-none bg-surface-muted object-cover", className)}
      {...props}
    />
  );
}
