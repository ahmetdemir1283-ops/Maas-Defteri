import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider } from './store';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Uygulama kökü bulunamadı.');

createRoot(container).render(
  <AppProvider>
    <App />
  </AppProvider>,
);

const hasManifest = Boolean(document.querySelector('link[rel="manifest"]'));
if (import.meta.env.PROD && hasManifest && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' })
      .catch(() => undefined);
  });
}
