"use client";

import { useEffect, useRef, useState } from "react";
import {
  AccountIcon,
  BagIcon,
  HeartIcon,
  MenuIcon,
  SearchIcon,
  StoreIcon,
} from "@/components/icons";
import { IconButton, IconLink } from "@/components/primitives";
import { MAIN_NAV } from "@/config/navigation";
import { cn } from "@/lib/utils/cn";
import { selectBagCount, useBagStore } from "@/stores/bag";
import { useUiStore } from "@/stores/ui";
import { Logo } from "./Logo";
import { MegaMenu } from "./MegaMenu";

const COMPACT_AFTER = 80;
const DIRECTION_THRESHOLD = 6;

/** Hides on scroll down, returns on scroll up, compacts after 80px. */
function useHeaderScroll(locked: boolean) {
  const [state, setState] = useState({ hidden: false, compact: false });
  const last = useRef(0);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - last.current;
        setState((prev) => {
          let hidden = prev.hidden;
          if (y <= COMPACT_AFTER || locked) hidden = false;
          else if (delta > DIRECTION_THRESHOLD) hidden = true;
          else if (delta < -DIRECTION_THRESHOLD) hidden = false;
          const compact = y > COMPACT_AFTER;
          return hidden === prev.hidden && compact === prev.compact ? prev : { hidden, compact };
        });
        if (Math.abs(delta) > DIRECTION_THRESHOLD) last.current = y;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [locked]);

  return state;
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { hidden, compact } = useHeaderScroll(menuOpen);
  const open = useUiStore((s) => s.open);
  const bagCount = useBagStore(selectBagCount);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-line bg-canvas transition-transform duration-base ease-atelier print:hidden",
        hidden && "-translate-y-full",
      )}
    >
      <div
        className={cn(
          "container-page grid grid-cols-[1fr_auto_1fr] items-center transition-[height] duration-base ease-atelier lg:flex lg:justify-between lg:gap-8",
          compact ? "h-14 lg:h-16" : "h-16 lg:h-20",
        )}
      >
        <div className="flex items-center lg:hidden">
          <IconButton
            label="Open menu"
            icon={<MenuIcon size={24} />}
            onClick={() => open("mobile-nav")}
            className="-ml-2.5"
          />
          <IconButton
            label="Search"
            icon={<SearchIcon size={24} />}
            onClick={() => open("search")}
          />
        </div>

        <div className="flex items-center gap-10">
          <Logo compact={compact} />
          <MegaMenu items={MAIN_NAV} onOpenChange={setMenuOpen} />
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => open("search")}
            className="mr-2 hidden h-10 w-56 items-center gap-3 border border-ink-subtle px-3 text-sm text-ink-subtle transition-colors duration-fast hover:border-ink xl:flex"
          >
            <SearchIcon />
            <span>Search</span>
          </button>
          <IconButton
            label="Search"
            icon={<SearchIcon size={24} />}
            onClick={() => open("search")}
            className="hidden lg:inline-flex xl:hidden"
          />
          <IconLink
            href="/stores"
            label="Find a store"
            icon={<StoreIcon size={24} />}
            className="hidden lg:inline-flex"
          />
          <IconLink
            href="/account"
            label="Account"
            icon={<AccountIcon size={24} />}
            className="hidden sm:inline-flex"
          />
          <IconLink
            href="/account/wishlist"
            label="Wishlist"
            icon={<HeartIcon size={24} />}
            className="hidden md:inline-flex"
          />
          <IconLink
            href="/bag"
            label="Bag"
            icon={<BagIcon size={24} />}
            count={bagCount}
            className="-mr-2.5"
          />
        </div>
      </div>
    </header>
  );
}
