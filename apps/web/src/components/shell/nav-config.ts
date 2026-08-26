import {
  ClipboardList,
  FileText,
  History,
  LayoutGrid,
  MonitorPlay,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Matches this item as active for any nested route under `href`. */
  matchPrefix?: boolean;
}

/** Order and labels taken verbatim from the sidebar in the Figma screens. */
export const PRIMARY_NAV: NavItem[] = [
  { label: 'Home', href: '/', icon: LayoutGrid },
  { label: 'My Classroom', href: '/classroom', icon: MonitorPlay, matchPrefix: true },
  { label: 'Assignments', href: '/assignments', icon: FileText, matchPrefix: true },
  { label: 'Exams', href: '/exams', icon: ClipboardList, matchPrefix: true },
  { label: 'My Library', href: '/library', icon: History, matchPrefix: true },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/') return pathname === '/';
  return item.matchPrefix ? pathname.startsWith(item.href) : pathname === item.href;
}
