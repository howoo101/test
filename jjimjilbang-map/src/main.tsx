import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppStateProvider } from './AppContext';
import { AppProvider } from './AppProvider';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </AppProvider>
  </StrictMode>,
);
