import { ErrorState } from "@/components/feedback/ErrorState";
import { ButtonLink } from "@/components/primitives";

/** Shown when a signed-in user lacks the permission a page needs (403). */
export default function Forbidden() {
  return (
    <main className="flex flex-1 flex-col">
      <ErrorState
        layout="page"
        eyebrow="Error 403"
        title="You don't have access to this page"
        description="Your account doesn't include permission for this area. If you think it should, ask an administrator."
        actions={
          <>
            <ButtonLink href="/">Go to the homepage</ButtonLink>
            <ButtonLink href="/account" variant="secondary">
              Your account
            </ButtonLink>
          </>
        }
      />
    </main>
  );
}
