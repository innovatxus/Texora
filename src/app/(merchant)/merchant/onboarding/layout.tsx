import { Stepper } from "@/components/merchant/onboarding/Stepper";
import { getMerchantContext } from "@/lib/merchant/context";

/** Shop setup: the five-step stepper above each step (journey §6). */
export default async function OnboardingLayout({ children }: LayoutProps<"/merchant/onboarding">) {
  const { shop } = await getMerchantContext();
  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-4xl">Set up your shop</h1>
        <Stepper completed={shop?.completedSteps ?? []} hasShop={shop !== null} />
      </div>
      {children}
    </div>
  );
}
