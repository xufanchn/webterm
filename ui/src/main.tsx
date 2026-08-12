import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

// Auto-adapt UI scale to window size (fonts scale, fixed layout stays intact)
function applyUIScale() {
  const scale = Math.min(1.2, Math.max(0.85, Math.min(window.innerWidth / 1400, window.innerHeight / 800)));
  document.documentElement.style.setProperty('--ui-scale', scale.toFixed(3));
}
applyUIScale();
window.addEventListener('resize', applyUIScale);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
