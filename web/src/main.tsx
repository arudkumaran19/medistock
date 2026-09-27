// SHARED SCAFFOLDING - NOT owned by the Demand vertical.
// Created by Sathurstiga S. (IT24103156) so the demand feature runs. The web owners
// replace this on integration.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import AuthProvider from './app/AuthProvider';
import './styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The default of three retries with exponential backoff leaves the page on a
      // spinner for roughly ten seconds when the API is down. One retry covers a
      // transient blip and still surfaces the error state promptly.
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
