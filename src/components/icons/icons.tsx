import { Icon, type IconProps } from "./Icon";

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.25 15.25 5 5" />
    </Icon>
  );
}

export function BagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.75 8.25h14.5l-1 12h-12.5z" />
      <path d="M8.75 8.25V7a3.25 3.25 0 0 1 6.5 0v1.25" />
    </Icon>
  );
}

export interface HeartIconProps extends IconProps {
  /** Filled state for a saved/wishlisted item. */
  filled?: boolean;
}

export function HeartIcon({ filled = false, ...props }: HeartIconProps) {
  return (
    <Icon {...props}>
      <path
        d="M12 19.75s-7.25-4.4-7.25-10.1a4.15 4.15 0 0 1 7.25-2.77 4.15 4.15 0 0 1 7.25 2.77c0 5.7-7.25 10.1-7.25 10.1z"
        fill={filled ? "currentColor" : "none"}
      />
    </Icon>
  );
}

export function AccountIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.75" />
      <path d="M4.75 20.25c0-3.75 3.25-6.25 7.25-6.25s7.25 2.5 7.25 6.25" />
    </Icon>
  );
}

export function StoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.75 9.25 5.5 3.75h13l1.75 5.5z" />
      <path d="M5 9.25v11h14v-11" />
      <path d="M10 20.25v-5.5h4v5.5" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.75 7h16.5M3.75 12h16.5M3.75 17h16.5" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 15 6-6 6 6" />
    </Icon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m15 6-6 6 6 6" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.75 7h9.5M17.75 7h2.5M3.75 17h3.5M11.75 17h8.5" />
      <circle cx="15.5" cy="7" r="2.25" />
      <circle cx="9.5" cy="17" r="2.25" />
    </Icon>
  );
}

export function ZoomIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.25 15.25 5 5M10.5 8v5M8 10.5h5" />
    </Icon>
  );
}

export function TruckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.75 16.75V6.25h11v10.5M13.75 9.25h3.75l3.75 4v3.5h-1.5" />
      <path d="M9.25 16.75h4.5" />
      <circle cx="7" cy="17.25" r="1.75" />
      <circle cx="17" cy="17.25" r="1.75" />
    </Icon>
  );
}

export function ReturnIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.75 13.75 4 9l4.75-4.75" />
      <path d="M4 9h10.25a5.5 5.5 0 0 1 0 11H10.5" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  );
}

export const iconCatalog = {
  search: SearchIcon,
  bag: BagIcon,
  heart: HeartIcon,
  account: AccountIcon,
  store: StoreIcon,
  close: CloseIcon,
  menu: MenuIcon,
  "chevron-down": ChevronDownIcon,
  "chevron-up": ChevronUpIcon,
  "chevron-left": ChevronLeftIcon,
  "chevron-right": ChevronRightIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  filter: FilterIcon,
  zoom: ZoomIcon,
  truck: TruckIcon,
  return: ReturnIcon,
  check: CheckIcon,
} as const;

export type IconName = keyof typeof iconCatalog;
