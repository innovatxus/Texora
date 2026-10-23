import {
  siFacebook,
  siInstagram,
  siPinterest,
  siTelegram,
  siTiktok,
  siWhatsapp,
  siYoutube,
  type SimpleIcon,
} from "simple-icons";
import { SOCIAL_LINKS, type SocialNetwork } from "@/config/navigation";

const ICONS: Record<SocialNetwork, SimpleIcon> = {
  facebook: siFacebook,
  instagram: siInstagram,
  tiktok: siTiktok,
  whatsapp: siWhatsapp,
  telegram: siTelegram,
  youtube: siYoutube,
  pinterest: siPinterest,
};

/** Social profile links as icons in each network's own colour (TikTok uses ink, its mark is black). */
export function SocialIcons() {
  return (
    <ul aria-label="Follow us" className="flex flex-wrap items-center gap-3">
      {SOCIAL_LINKS.map((link) => {
        const icon = ICONS[link.network];
        const color = link.network === "tiktok" ? "var(--color-ink)" : `#${icon.hex}`;
        return (
          <li key={link.network}>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              title={link.label}
              className="flex size-11 items-center justify-center rounded-full transition-transform duration-base ease-atelier hover:scale-110 hover:bg-brand-tint"
            >
              <svg viewBox="0 0 24 24" width={22} height={22} fill={color} aria-hidden="true">
                <path d={icon.path} />
              </svg>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
