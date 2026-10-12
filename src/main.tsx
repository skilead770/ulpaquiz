import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { SchoolProvider } from './context/SchoolContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SchoolProvider>
      <App />
    </SchoolProvider>
  </StrictMode>,
);
