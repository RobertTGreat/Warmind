import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Book,
  Globe,
  Home,
  Layers,
  Scroll,
  ShieldCheck,
  Sparkles,
  Store,
  Swords,
  Target,
  Trophy,
  User,
} from 'lucide-react';

export type SubNavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

export type HeaderNavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
  subNav?: SubNavigationItem[];
  disabled?: boolean;
};

export type HeaderNavigationEntry = SubNavigationItem & {
  description?: string;
  parentName?: string;
};

export const headerNavigationItems: HeaderNavigationItem[] = [
  { name: 'Home', href: '/?home=1', icon: Home, description: 'Dashboard & Overview' },
  {
    name: 'Collections',
    href: '/collections',
    icon: Book,
    description: 'Weapons, Armor & More',
    subNav: [
      { name: 'Collections', href: '/collections', icon: Book },
      { name: 'Sets', href: '/collections/sets', icon: Layers },
      { name: 'Armor Sets', href: '/collections/armor-set-bonuses', icon: ShieldCheck },
    ],
  },
  { name: 'Triumphs', href: '/triumphs', icon: Trophy, description: 'Achievements & Seals' },
  {
    name: 'Character',
    href: '/character',
    icon: User,
    description: 'Inventory & Loadouts',
    subNav: [
      { name: 'Character', href: '/character', icon: User },
      { name: 'Loadouts', href: '/character/loadouts', icon: Layers },
      { name: 'Optimizer', href: '/character/optimizer', icon: Target },
    ],
  },
  { name: 'Quests', href: '/quests', icon: Scroll, description: 'Active Quests' },
  { name: 'Vendors', href: '/vendors', icon: Store, description: 'Tower & Rotating Stock' },
  {
    name: 'Activities',
    href: '/activity',
    icon: Globe,
    description: 'Past Activities',
    subNav: [
      { name: 'Activity Report', href: '/activity', icon: Activity },
      { name: 'Wrapped', href: '/activity/wrapped', icon: Sparkles },
    ],
  },
];

export const defaultFavouriteHeaderNavHrefs = [
  '/?home=1',
  '/collections',
  '/triumphs',
  '/character',
  '/quests',
  '/vendors',
  '/activity',
] as const;

export const sidebarSubNavigationItems: Record<string, SubNavigationItem[]> = {
  '/character': [
    { name: 'Character', href: '/character', icon: User },
    { name: 'Loadouts', href: '/character/loadouts', icon: Layers },
    { name: 'Optimizer', href: '/character/optimizer', icon: Target },
  ],
  '/collections': [
    { name: 'Collections', href: '/collections', icon: Book },
    { name: 'Sets', href: '/collections/sets', icon: Layers },
    { name: 'Armor Sets', href: '/collections/armor-set-bonuses', icon: ShieldCheck },
  ],
  '/triumphs': [
    { name: 'Triumphs', href: '/triumphs', icon: Trophy },
  ],
  '/quests': [
    { name: 'Quests', href: '/quests', icon: Swords },
  ],
  '/vendors': [
    { name: 'Vendors', href: '/vendors', icon: Store },
  ],
  '/activity': [
    { name: 'Activity', href: '/activity', icon: Activity },
    { name: 'Wrapped', href: '/activity/wrapped', icon: Sparkles },
  ],
};

export function getHeaderNavigationEntries(): HeaderNavigationEntry[] {
  const navigationEntryByHref = new Map<string, HeaderNavigationEntry>();

  for (const item of headerNavigationItems) {
    if (!item.disabled) {
      navigationEntryByHref.set(item.href, {
        name: item.name,
        href: item.href,
        icon: item.icon,
        description: item.description,
      });
    }

    for (const subItem of item.subNav ?? []) {
      if (!navigationEntryByHref.has(subItem.href)) {
        navigationEntryByHref.set(subItem.href, {
          ...subItem,
          parentName: item.name,
        });
      }
    }
  }

  return [...navigationEntryByHref.values()];
}

export function isNavigationHrefActive(pathname: string, href: string): boolean {
  const pathnameHref = href.split('?')[0] || '/';

  if (pathnameHref === '/') {
    return pathname === '/';
  }

  return pathname === pathnameHref || pathname.startsWith(`${pathnameHref}/`);
}
