import { useState, useCallback, useEffect } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest, fabricScopes } from '../config/authConfig';

/**
 * User info from authenticated account
 */
export interface UserInfo {
  name: string;
  email: string;
  tenantId: string;
}

/**
 * Auth hook return type
 */
export interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserInfo | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: (scopes?: string[]) => Promise<string>;
  error: Error | null;
}

/**
 * Custom hook for authentication operations
 * 
 * Provides:
 * - Authentication state
 * - User info
 * - Login/logout functions
 * - Token acquisition
 */
export function useAuth(): UseAuthReturn {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [error, setError] = useState<Error | null>(null);

  // Clear error when auth state changes
  useEffect(() => {
    if (isAuthenticated) {
      setError(null);
    }
  }, [isAuthenticated]);

  // Get user info from active account
  const user: UserInfo | null = accounts.length > 0
    ? {
        name: accounts[0].name || accounts[0].username,
        email: accounts[0].username,
        tenantId: accounts[0].tenantId,
      }
    : null;

  // Login handler
  const login = useCallback(async () => {
    try {
      setError(null);
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Login failed');
      setError(error);
      throw error;
    }
  }, [instance]);

  // Logout handler
  const logout = useCallback(async () => {
    try {
      setError(null);
      const account = accounts[0];
      await instance.logoutRedirect({
        account: account || undefined,
        postLogoutRedirectUri: '/',
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Logout failed');
      setError(error);
      throw error;
    }
  }, [instance, accounts]);

  // Token acquisition
  const getToken = useCallback(async (scopes: string[] = fabricScopes.fabric): Promise<string> => {
    const account = accounts[0];
    
    if (!account) {
      throw new Error('No authenticated account');
    }

    try {
      // Try silent first
      const response = await instance.acquireTokenSilent({
        scopes,
        account,
      });
      return response.accessToken;
    } catch (err) {
      // Fall back to popup
      try {
        const response = await instance.acquireTokenPopup({ scopes });
        return response.accessToken;
      } catch (popupErr) {
        const error = popupErr instanceof Error ? popupErr : new Error('Token acquisition failed');
        setError(error);
        throw error;
      }
    }
  }, [instance, accounts]);

  return {
    isAuthenticated,
    isLoading: inProgress !== InteractionStatus.None,
    user,
    login,
    logout,
    getToken,
    error,
  };
}

/**
 * Hook to get a token for Fabric API with automatic refresh
 */
export function useFabricToken() {
  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refreshToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const newToken = await getToken(fabricScopes.fabric);
      setToken(newToken);
      return newToken;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Token refresh failed');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  return { token, loading, error, refreshToken };
}
