import { ErrorState } from "@/components/feedback/ErrorState";
import { Logo } from "@/components/navigation/Logo";
import { ButtonLink } from "@/components/primitives";
import { POPULAR_CATEGORIES } from "@/config/navigation";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="container-page flex h-20 items-center border-b border-line">
        <Logo />
      </header>
      <main id="main" className="flex flex-1 flex-col">
        <ErrorState
          layout="page"
          eyebrow="Error 404"
          title="We can't find that page"
          description={
            <>
              <p>It may have moved, or the link may be out of date. Try one of these instead:</p>
              <ul className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2">
                {POPULAR_CATEGORIES.map((c) => (
                  <li key={c.href}>
                    <a href={c.href} className="text-ink underline underline-offset-4">
                      {c.label}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          }
          actions={<ButtonLink href="/">Go to the homepage</ButtonLink>}
        />
      </main>
    </div>
  );
}
