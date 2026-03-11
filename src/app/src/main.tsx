import React from 'react';
import ReactDOM from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { BrowserRouter } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication, EventType, AuthenticationResult } from '@azure/msal-browser';
import App from './App';
import { msalConfig } from './config/authConfig';
import { initializeAuthService } from './services/authService';
import './index.css';

// Initialize MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

// Initialize auth service singleton
initializeAuthService(msalInstance);

// Handle redirect promise on page load
msalInstance.initialize().then(() => {
  // Handle redirect callback
  msalInstance.handleRedirectPromise().then((response) => {
    if (response) {
      console.log('Login successful:', response.account?.username);
      // Set the active account if login was successful
      msalInstance.setActiveAccount(response.account);
    }
  }).catch((error) => {
    console.error('Redirect error:', error);
  });

  // Set active account on page load if available
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0]);
  }

  // Listen for sign-in events
  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as AuthenticationResult;
      msalInstance.setActiveAccount(payload.account);
    }
  });

  // Render app after MSAL is initialized
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <FluentProvider theme={webLightTheme}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </FluentProvider>
      </MsalProvider>
    </React.StrictMode>
  );
});

