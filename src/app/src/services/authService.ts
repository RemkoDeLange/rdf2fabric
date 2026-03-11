import {
  PublicClientApplication,
  AccountInfo,
  AuthenticationResult,
  InteractionRequiredAuthError,
  SilentRequest,
  PopupRequest,
} from '@azure/msal-browser';
import { fabricScopes } from '../config/authConfig';

/**
 * AuthService - Token acquisition and management for Fabric API
 * 
 * Handles:
 * - Silent token acquisition (from cache)
 * - Interactive fallback (popup/redirect)
 * - Multi-scope token management
 * - Token refresh (automatic via MSAL)
 */
export class AuthService {
  private msalInstance: PublicClientApplication;

  constructor(msalInstance: PublicClientApplication) {
    this.msalInstance = msalInstance;
  }

  /**
   * Get current authenticated account
   */
  getAccount(): AccountInfo | null {
    const accounts = this.msalInstance.getAllAccounts();
    if (accounts.length === 0) return null;
    
    // Return the first account (for single-account scenarios)
    // For multi-account, you'd want account selection UI
    return accounts[0];
  }

  /**
   * Get user info from current account
   */
  getUserInfo(): { name: string; email: string; tenantId: string } | null {
    const account = this.getAccount();
    if (!account) return null;

    return {
      name: account.name || account.username,
      email: account.username,
      tenantId: account.tenantId,
    };
  }

  /**
   * Acquire token for Fabric API
   * Tries silent acquisition first, falls back to interactive
   */
  async getTokenForFabric(): Promise<string> {
    return this.getToken(fabricScopes.fabric);
  }

  /**
   * Acquire token for OneLake storage
   */
  async getTokenForStorage(): Promise<string> {
    return this.getToken(fabricScopes.storage);
  }

  /**
   * Generic token acquisition with silent-first strategy
   */
  async getToken(scopes: string[]): Promise<string> {
    const account = this.getAccount();
    
    if (!account) {
      throw new Error('No authenticated account. Please sign in first.');
    }

    const silentRequest: SilentRequest = {
      scopes,
      account,
      forceRefresh: false,
    };

    try {
      // Try silent token acquisition (from cache or refresh)
      const response = await this.msalInstance.acquireTokenSilent(silentRequest);
      return response.accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        // Token cache miss or expired - need interactive login
        return this.acquireTokenInteractive(scopes);
      }
      throw error;
    }
  }

  /**
   * Interactive token acquisition (popup for web, device code for Electron)
   */
  private async acquireTokenInteractive(scopes: string[]): Promise<string> {
    const isElectron = this.isElectronEnvironment();

    if (isElectron) {
      // Device code flow for Electron
      // Note: This requires @azure/msal-node in the main process
      // For now, fall back to popup which works in Electron renderer
      console.warn('Device code flow not yet implemented. Using popup.');
    }

    // Popup flow works for both web and Electron renderer
    const popupRequest: PopupRequest = {
      scopes,
    };

    const response = await this.msalInstance.acquireTokenPopup(popupRequest);
    return response.accessToken;
  }

  /**
   * Check if running in Electron environment
   */
  private isElectronEnvironment(): boolean {
    // Check for Electron-specific globals
    return typeof window !== 'undefined' && 
           typeof window.process === 'object' &&
           // eslint-disable-next-line @typescript-eslint/no-explicit-any
           (window as any).process?.type === 'renderer';
  }

  /**
   * Sign in user (redirect flow)
   */
  async signIn(): Promise<void> {
    await this.msalInstance.loginRedirect({
      scopes: ['openid', 'profile', 'email', ...fabricScopes.fabric],
    });
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<void> {
    const account = this.getAccount();
    await this.msalInstance.logoutRedirect({
      account: account || undefined,
    });
  }

  /**
   * Handle redirect callback (call on app init)
   */
  async handleRedirectCallback(): Promise<AuthenticationResult | null> {
    return this.msalInstance.handleRedirectPromise();
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getAccount() !== null;
  }
}

// Singleton instance holder
let authServiceInstance: AuthService | null = null;

/**
 * Initialize auth service with MSAL instance
 */
export function initializeAuthService(msalInstance: PublicClientApplication): AuthService {
  authServiceInstance = new AuthService(msalInstance);
  return authServiceInstance;
}

/**
 * Get auth service instance
 */
export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    throw new Error('AuthService not initialized. Call initializeAuthService first.');
  }
  return authServiceInstance;
}
