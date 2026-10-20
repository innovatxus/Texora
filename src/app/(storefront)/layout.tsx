import { Suspense } from "react";
import { BagDrawer } from "@/components/bag/BagDrawer";
import { ConsentBanner } from "@/components/marketing/ConsentBanner";
import { SignupModal } from "@/components/marketing/SignupModal";
import { AnnouncementBar } from "@/components/navigation/AnnouncementBar";
import { Footer } from "@/components/navigation/Footer";
import { Header } from "@/components/navigation/Header";
import { SkipLink } from "@/components/navigation/Logo";
import { MobileNav } from "@/components/navigation/MobileNav";
import { SearchOverlay } from "@/components/navigation/SearchOverlay";
import { ANNOUNCEMENTS } from "@/config/announcements";
import { StoreHydration } from "@/stores/StoreHydration";

export default function StorefrontLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SkipLink />
      <AnnouncementBar announcements={ANNOUNCEMENTS} />
      <Header />
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
      <Footer />
      <MobileNav />
      <SearchOverlay />
      <BagDrawer />
      <ConsentBanner />
      {/* Reads the pathname: under a Suspense boundary so routes with request-time params still prerender their shell. */}
      <Suspense fallback={null}>
        <SignupModal />
      </Suspense>
      <StoreHydration />
    </>
  );
}
