import { redirect } from "next/navigation";

/** `/merchant/shop` opens the profile tab. */
export default function Page() {
  redirect("/merchant/shop/profile");
}
