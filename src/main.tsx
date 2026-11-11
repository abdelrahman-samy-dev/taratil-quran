import '@fontsource-variable/cairo/wght.css';
import '@fontsource/amiri/arabic-400.css';
import '@fontsource/amiri/arabic-700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

import { render } from 'preact';
import { App } from './app';
import { initAchievements } from './features/werd/achievements';
import { updateReady } from './layout/UpdateBanner';
import './state/prefs';

render(<App />, document.getElementById('app')!);

initAchievements();

// Prayer reminders run app-wide once the user has turned them on.
if (localStorage.getItem('taratil:prayer:settings')?.includes('"notify":true')) {
  void import('./features/prayer/reminders').then((m) => m.startPrayerReminders());
}

if ('serviceWorker' in navigator) {
  // The service worker asks us to open a screen (e.g. a tapped prayer reminder).
  navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type === 'NAVIGATE' && typeof e.data.url === 'string' && e.data.url.startsWith('/')) {
      history.pushState(null, '', e.data.url);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  void import('workbox-window').then(({ Workbox }) => {
    const wb = new Workbox('/sw.js');
    wb.addEventListener('waiting', () => {
      updateReady.value = () => {
        wb.addEventListener('controlling', () => location.reload());
        wb.messageSkipWaiting();
      };
    });
    void wb.register();
  });
}
