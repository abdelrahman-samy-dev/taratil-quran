import type { IconName } from '../ui/Icon';

export interface NavItem {
  path: string;
  label: string;
  short?: string;
  icon: IconName;
  /** Shown in the mobile bottom bar. */
  primary?: boolean;
}

export const NAV: NavItem[] = [
  { path: '/', label: 'الرئيسية', icon: 'home', primary: true },
  { path: '/mushaf', label: 'المصحف', icon: 'book', primary: true },
  { path: '/listen', label: 'الاستماع', short: 'استماع', icon: 'headphones', primary: true },
  { path: '/azkar', label: 'الأذكار', short: 'أذكار', icon: 'sun', primary: true },
  { path: '/tafsir', label: 'التفسير والتسميع', short: 'التفسير', icon: 'scroll' },
  { path: '/prayer', label: 'مواقيت الصلاة', short: 'المواقيت', icon: 'clock' },
  { path: '/qibla', label: 'اتجاه القبلة', short: 'القبلة', icon: 'compass' },
  { path: '/tasbeeh', label: 'السبحة', icon: 'beads' },
  { path: '/radio', label: 'إذاعات القرآن', short: 'الإذاعة', icon: 'radio' },
  { path: '/hadith', label: 'الأحاديث', icon: 'library' },
  { path: '/werd', label: 'الورد والإنجازات', short: 'الورد', icon: 'target' },
  { path: '/search', label: 'البحث في القرآن', short: 'البحث', icon: 'search' },
  { path: '/settings', label: 'الإعدادات', icon: 'settings' },
];

export function isActive(path: string, current: string): boolean {
  if (path === '/') return current === '/';
  return current === path || current.startsWith(`${path}/`);
}
