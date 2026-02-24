import { Configuration, LogLevel } from '@azure/msal-browser';

/**
 * MSAL Configuration
 * 
 * To configure:
 * 1. Create an app registration in Entra ID
 * 2. Add redirect URIs: http://localhost:5173, msal://{clientId}/auth
 * 3. Enable public client flows for device code (Electron)
 * 4. Add API permissions: Power BI Service (Dataset.ReadWrite.All)
 */

// Replace with your app registration client ID
const CLIENT_ID = import.meta.env.VITE_MSAL_CLIENT_ID || 'YOUR_CLIENT_ID';

export const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
    postLogoutRedirectUri: '/',
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            break;
          case LogLevel.Warning:
            console.warn(message);
            break;
          case LogLevel.Info:
            console.info(message);
            break;
          case LogLevel.Verbose:
            console.debug(message);
            break;
        }
      },
      logLevel: LogLevel.Warning,
    },
  },
};

// Scopes for Fabric Graph API access
export const fabricScopes = {
  // Power BI / Fabric API scope
  fabric: ['https://analysis.windows.net/powerbi/api/.default'],
  // OneLake storage scope
  storage: ['https://storage.azure.com/.default'],
};

// Login request configuration
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', ...fabricScopes.fabric],
};
