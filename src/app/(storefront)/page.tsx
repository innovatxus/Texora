import { brand } from "@/config/brand";

export default function HomePage() {
  return (
    <div className="container-page flex flex-1 flex-col items-center justify-center section-y text-center">
      <p className="text-label text-ink-subtle">New season</p>
      <h1 className="mt-4 font-display text-5xl font-normal">{brand.name}</h1>
      <p className="mt-6 max-w-md text-lg text-ink-soft">{brand.tagline}</p>
    </div>
  );
}
