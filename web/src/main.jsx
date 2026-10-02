import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  document.querySelector('link[rel="icon"]').href = '/favicon-local.svg';
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
