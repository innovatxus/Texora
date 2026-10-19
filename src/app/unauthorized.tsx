import { ErrorState } from "@/components/feedback/ErrorState";
import { ButtonLink } from "@/components/primitives";
import { SIGN_IN_PATH } from "@/lib/auth/access";

export default function Unauthorized() {
  return (
    <main className="flex flex-1 flex-col">
      <ErrorState
        layout="page"
        eyebrow="Error 401"
        title="Please sign in"
        description="You need to be signed in to see this page."
        actions={
          <>
            <ButtonLink href={SIGN_IN_PATH}>Sign in</ButtonLink>
            <ButtonLink href="/" variant="secondary">
              Continue shopping
            </ButtonLink>
          </>
        }
      />
    </main>
  );
}
