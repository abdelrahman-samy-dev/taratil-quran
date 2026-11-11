import { ErrorBoundary, LocationProvider, Route, Router, lazy } from 'preact-iso';
import { Shell } from './layout/Shell';
import { Empty } from './ui/kit';

// Every screen is its own chunk; Home is small and loads with the shell.
import Home from './features/home/HomePage';
const Mushaf = lazy(() => import('./features/mushaf/MushafPage'));
const Listen = lazy(() => import('./features/listen/ListenPage'));
const Tafsir = lazy(() => import('./features/tafsir/TafsirPage'));
const Azkar = lazy(() => import('./features/azkar/AzkarPage'));
const Prayer = lazy(() => import('./features/prayer/PrayerPage'));
const Qibla = lazy(() => import('./features/prayer/QiblaPage'));
const Tasbeeh = lazy(() => import('./features/tasbeeh/TasbeehPage'));
const Radio = lazy(() => import('./features/radio/RadioPage'));
const Hadith = lazy(() => import('./features/hadith/HadithPage'));
const Werd = lazy(() => import('./features/werd/WerdPage'));
const Search = lazy(() => import('./features/search/SearchPage'));
const Settings = lazy(() => import('./features/settings/SettingsPage'));

function NotFound() {
  return (
    <Empty icon="info" title="الصفحة غير موجودة">
      <a class="btn" href="/">
        العودة للرئيسية
      </a>
    </Empty>
  );
}

export function App() {
  return (
    <LocationProvider>
      <ErrorBoundary>
        <Shell>
          <Router>
            <Route path="/" component={Home} />
            <Route path="/mushaf" component={Mushaf} />
            <Route path="/mushaf/:page" component={Mushaf} />
            <Route path="/listen" component={Listen} />
            <Route path="/tafsir" component={Tafsir} />
            <Route path="/tafsir/:surah" component={Tafsir} />
            <Route path="/azkar" component={Azkar} />
            <Route path="/azkar/:cat" component={Azkar} />
            <Route path="/prayer" component={Prayer} />
            <Route path="/qibla" component={Qibla} />
            <Route path="/tasbeeh" component={Tasbeeh} />
            <Route path="/radio" component={Radio} />
            <Route path="/hadith" component={Hadith} />
            <Route path="/hadith/:book" component={Hadith} />
            <Route path="/werd" component={Werd} />
            <Route path="/search" component={Search} />
            <Route path="/settings" component={Settings} />
            <Route default component={NotFound} />
          </Router>
        </Shell>
      </ErrorBoundary>
    </LocationProvider>
  );
}
