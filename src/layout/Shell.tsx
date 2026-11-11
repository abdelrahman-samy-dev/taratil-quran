import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { useLocation } from 'preact-iso';
import { track } from '../audio/player';
import { Icon } from '../ui/Icon';
import { Sheet } from '../ui/Sheet';
import { Toaster } from '../ui/toast';
import { FullPlayer } from './FullPlayer';
import { MiniPlayer } from './MiniPlayer';
import { NAV, isActive } from './nav';
import { UpdateBanner } from './UpdateBanner';

export function Shell({ children }: { children: ComponentChildren }) {
  const { path, route } = useLocation();
  const moreOpen = useSignal(false);
  const immersive = path.startsWith('/mushaf');

  const section = path.split('/')[1] ?? '';
  useEffect(() => {
    moreOpen.value = false;
  }, [path]);
  useEffect(() => {
    // New section: start at the top and move focus for screen readers. Sub-routes
    // (e.g. azkar tabs) keep focus where it is.
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [section]);

  const primary = NAV.filter((n) => n.primary);
  const secondary = NAV.filter((n) => !n.primary);
  const moreActive = secondary.some((n) => isActive(n.path, path));

  return (
    <div class={`app${track.value ? ' has-player' : ''}${immersive ? ' immersive' : ''}`}>
      <a class="skip-link" href="#main">
        تخطَّ إلى المحتوى
      </a>

      <aside class="sidebar" aria-label="التنقل الرئيسي">
        <a href="/" class="brand">
          <span class="brand-mark">
            <Icon name="logo" size={26} />
          </span>
          <span class="brand-name">تراتيل</span>
        </a>
        <nav>
          {NAV.map((n) => (
            <a
              key={n.path}
              href={n.path}
              class={`side-link${isActive(n.path, path) ? ' active' : ''}`}
              aria-current={isActive(n.path, path) ? 'page' : undefined}
            >
              <Icon name={n.icon} size={20} />
              <span>{n.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      <header class="topbar">
        <a href="/" class="brand">
          <span class="brand-mark">
            <Icon name="logo" size={22} />
          </span>
          <span class="brand-name">تراتيل</span>
        </a>
        <div class="topbar-actions">
          <a href="/search" class="icon-btn" aria-label="البحث في القرآن">
            <Icon name="search" size={20} />
          </a>
          <a href="/settings" class="icon-btn" aria-label="الإعدادات">
            <Icon name="settings" size={20} />
          </a>
        </div>
      </header>

      <main id="main" class="main" tabIndex={-1}>
        <UpdateBanner />
        {children}
      </main>

      <MiniPlayer />
      <FullPlayer />

      <nav class="bottombar" aria-label="التنقل">
        {primary.map((n) => (
          <a
            key={n.path}
            href={n.path}
            class={`bottom-link${isActive(n.path, path) ? ' active' : ''}`}
            aria-current={isActive(n.path, path) ? 'page' : undefined}
          >
            <Icon name={n.icon} size={22} />
            <span>{n.short ?? n.label}</span>
          </a>
        ))}
        <button
          class={`bottom-link${moreActive || moreOpen.value ? ' active' : ''}`}
          onClick={() => (moreOpen.value = true)}
          aria-haspopup="dialog"
        >
          <Icon name="grid" size={22} />
          <span>المزيد</span>
        </button>
      </nav>

      <Sheet open={moreOpen.value} onClose={() => (moreOpen.value = false)} title="كل الأقسام">
        <div class="more-grid">
          {secondary.map((n) => (
            <button
              key={n.path}
              class={`more-item${isActive(n.path, path) ? ' active' : ''}`}
              onClick={() => {
                moreOpen.value = false;
                route(n.path);
              }}
            >
              <span class="more-icon">
                <Icon name={n.icon} size={22} />
              </span>
              <span>{n.short ?? n.label}</span>
            </button>
          ))}
        </div>
      </Sheet>

      <Toaster />
    </div>
  );
}
