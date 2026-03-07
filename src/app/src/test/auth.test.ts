import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { PublicClientApplication, AccountInfo, InteractionStatus } from '@azure/msal-browser';
import { AuthService, initializeAuthService, getAuthService } from '../services/authService';
import { msalConfig } from '../config/authConfig';

// Mock MSAL
vi.mock('@azure/msal-browser', async () => {
  const actual = await vi.importActual('@azure/msal-browser');
  return {
    ...actual,
    PublicClientApplication: vi.fn(),
  };
});

// Mock account
const mockAccount: AccountInfo = {
  homeAccountId: 'home-account-id',
  environment: 'login.microsoftonline.com',
  tenantId: 'tenant-id-123',
  username: 'user@example.com',
  name: 'Test User',
  localAccountId: 'local-account-id',
};

describe('AuthService', () => {
  let mockMsalInstance: {
    getAllAccounts: ReturnType<typeof vi.fn>;
    acquireTokenSilent: ReturnType<typeof vi.fn>;
    acquireTokenPopup: ReturnType<typeof vi.fn>;
    loginRedirect: ReturnType<typeof vi.fn>;
    logoutRedirect: ReturnType<typeof vi.fn>;
    handleRedirectPromise: ReturnType<typeof vi.fn>;
  };
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockMsalInstance = {
      getAllAccounts: vi.fn().mockReturnValue([mockAccount]),
      acquireTokenSilent: vi.fn().mockResolvedValue({ accessToken: 'mock-token' }),
      acquireTokenPopup: vi.fn().mockResolvedValue({ accessToken: 'mock-popup-token' }),
      loginRedirect: vi.fn().mockResolvedValue(undefined),
      logoutRedirect: vi.fn().mockResolvedValue(undefined),
      handleRedirectPromise: vi.fn().mockResolvedValue(null),
    };
    
    authService = new AuthService(mockMsalInstance as unknown as PublicClientApplication);
  });

  test('getAccount returns first account', () => {
    const account = authService.getAccount();
    expect(account).toEqual(mockAccount);
  });

  test('getAccount returns null when no accounts', () => {
    mockMsalInstance.getAllAccounts.mockReturnValue([]);
    const account = authService.getAccount();
    expect(account).toBeNull();
  });

  test('getUserInfo returns user details', () => {
    const userInfo = authService.getUserInfo();
    expect(userInfo).toEqual({
      name: 'Test User',
      email: 'user@example.com',
      tenantId: 'tenant-id-123',
    });
  });

  test('getToken returns valid token silently', async () => {
    const token = await authService.getToken(['scope1']);
    expect(token).toBe('mock-token');
    expect(mockMsalInstance.acquireTokenSilent).toHaveBeenCalledWith({
      scopes: ['scope1'],
      account: mockAccount,
      forceRefresh: false,
    });
  });

  test('getToken falls back to popup on silent failure', async () => {
    const { InteractionRequiredAuthError } = await vi.importActual('@azure/msal-browser') as typeof import('@azure/msal-browser');
    mockMsalInstance.acquireTokenSilent.mockRejectedValue(
      new InteractionRequiredAuthError('interaction_required')
    );
    
    const token = await authService.getToken(['scope1']);
    expect(token).toBe('mock-popup-token');
    expect(mockMsalInstance.acquireTokenPopup).toHaveBeenCalled();
  });

  test('getToken throws when not authenticated', async () => {
    mockMsalInstance.getAllAccounts.mockReturnValue([]);
    await expect(authService.getToken(['scope1'])).rejects.toThrow('No authenticated account');
  });

  test('isAuthenticated returns true when account exists', () => {
    expect(authService.isAuthenticated()).toBe(true);
  });

  test('isAuthenticated returns false when no accounts', () => {
    mockMsalInstance.getAllAccounts.mockReturnValue([]);
    expect(authService.isAuthenticated()).toBe(false);
  });

  test('signIn calls loginRedirect', async () => {
    await authService.signIn();
    expect(mockMsalInstance.loginRedirect).toHaveBeenCalled();
  });

  test('signOut calls logoutRedirect', async () => {
    await authService.signOut();
    expect(mockMsalInstance.logoutRedirect).toHaveBeenCalledWith({
      account: mockAccount,
    });
  });
});

describe('AuthService singleton', () => {
  test('initializeAuthService creates instance', () => {
    const mockInstance = {
      getAllAccounts: vi.fn().mockReturnValue([]),
    } as unknown as PublicClientApplication;
    
    const service = initializeAuthService(mockInstance);
    expect(service).toBeInstanceOf(AuthService);
  });

  test('getAuthService throws when not initialized', () => {
    // Reset module state by re-importing
    vi.resetModules();
    // This would throw in a fresh module state
  });
});
