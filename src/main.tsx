// Must run first: moves v3 data into the v4 store before anything reads it.
import './state/migrate';

import '@fontsource-variable/cairo/wght.css';
import '@fontsource/amiri/arabic-400.css';
import '@fontsource/amiri/arabic-700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

import { render } from 'preact';
import { App } from './app';
import { updateReady } from './layout/UpdateBanner';
import './state/prefs';

render(<App />, document.getElementById('app')!);

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
