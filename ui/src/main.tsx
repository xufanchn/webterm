import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';
import { usePreferencesStore } from './store/preferences';

// Apply saved UI scale (managed in Settings → Appearance)
document.documentElement.style.setProperty('--ui-scale', String(usePreferencesStore.getState().uiScale));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
