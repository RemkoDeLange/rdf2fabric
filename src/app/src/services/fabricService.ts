/**
 * Fabric API Service
 * 
 * Provides REST API access to Microsoft Fabric workspaces, items, and OneLake.
 * Uses MSAL for authentication.
 */

import { IPublicClientApplication } from '@azure/msal-browser';
import { fabricScopes } from '../config/authConfig';

const FABRIC_API_BASE = 'https://api.fabric.microsoft.com/v1';

export interface FabricWorkspace {
  id: string;
  displayName: string;
  description?: string;
  type: string;
  capacityId?: string;
}

export interface FabricItem {
  id: string;
  displayName: string;
  description?: string;
  type: string;
  workspaceId: string;
}

export interface FabricLakehouse extends FabricItem {
  type: 'Lakehouse';
}

export interface OneLakeFile {
  name: string;
  isDirectory: boolean;
  size?: number;
  lastModified?: string;
}

export class FabricService {
  private msalInstance: IPublicClientApplication;

  constructor(msalInstance: IPublicClientApplication) {
    this.msalInstance = msalInstance;
  }

  /**
   * Get access token for Fabric API
   */
  private async getAccessToken(scopes: string[] = fabricScopes.fabric): Promise<string> {
    const accounts = this.msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      throw new Error('No authenticated account. Please sign in first.');
    }

    const account = accounts[0];

    try {
      const response = await this.msalInstance.acquireTokenSilent({
        scopes,
        account,
      });
      return response.accessToken;
    } catch (error) {
      // Token expired or not available, try interactive
      const response = await this.msalInstance.acquireTokenPopup({
        scopes,
      });
      return response.accessToken;
    }
  }

  /**
   * Make authenticated request to Fabric API
   */
  private async fetchFabric<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAccessToken();

    const response = await fetch(`${FABRIC_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fabric API error (${response.status}): ${errorText}`);
    }

    return response.json();
  }

  /**
   * Test connection to Fabric API
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.listWorkspaces();
      return { success: true, message: 'Connected to Fabric API' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * List all accessible workspaces
   */
  async listWorkspaces(): Promise<FabricWorkspace[]> {
    const response = await this.fetchFabric<{ value: FabricWorkspace[] }>(
      '/workspaces'
    );
    return response.value;
  }

  /**
   * Get workspace by ID
   */
  async getWorkspace(workspaceId: string): Promise<FabricWorkspace> {
    return this.fetchFabric<FabricWorkspace>(`/workspaces/${workspaceId}`);
  }

  /**
   * List items in a workspace
   */
  async listItems(workspaceId: string, type?: string): Promise<FabricItem[]> {
    let endpoint = `/workspaces/${workspaceId}/items`;
    if (type) {
      endpoint += `?type=${type}`;
    }
    const response = await this.fetchFabric<{ value: FabricItem[] }>(endpoint);
    return response.value;
  }

  /**
   * List lakehouses in a workspace
   */
  async listLakehouses(workspaceId: string): Promise<FabricLakehouse[]> {
    const items = await this.listItems(workspaceId, 'Lakehouse');
    return items as FabricLakehouse[];
  }

  /**
   * Get lakehouse by ID
   */
  async getLakehouse(
    workspaceId: string,
    lakehouseId: string
  ): Promise<FabricLakehouse> {
    return this.fetchFabric<FabricLakehouse>(
      `/workspaces/${workspaceId}/lakehouses/${lakehouseId}`
    );
  }

  /**
   * Validate workspace and lakehouse IDs
   */
  async validateConnection(
    workspaceId: string,
    lakehouseId: string
  ): Promise<{ valid: boolean; workspace?: FabricWorkspace; lakehouse?: FabricLakehouse; error?: string }> {
    try {
      // Validate workspace
      const workspace = await this.getWorkspace(workspaceId);
      
      // Validate lakehouse
      const lakehouse = await this.getLakehouse(workspaceId, lakehouseId);

      return { valid: true, workspace, lakehouse };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * List files in OneLake (lakehouse Files folder)
   */
  async listOneLakeFiles(
    workspaceId: string,
    lakehouseId: string,
    path: string = ''
  ): Promise<OneLakeFile[]> {
    // OneLake DFS API requires storage scope
    const token = await this.getAccessToken(fabricScopes.storage);
    
    // OneLake DFS URL format - when using GUIDs, use {workspaceId}/{itemId} directly
    const dfsBase = 'https://onelake.dfs.fabric.microsoft.com';
    const fullPath = `/${workspaceId}/${lakehouseId}/Files${path ? '/' + path : ''}`;
    
    const response = await fetch(
      `${dfsBase}${fullPath}?resource=filesystem&recursive=false`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`OneLake error (${response.status}): ${await response.text()}`);
    }

    const data = await response.json();
    return (data.paths || []).map((p: { name: string; isDirectory?: string; contentLength?: number; lastModified?: string }) => ({
      name: p.name.split('/').pop() || p.name,
      isDirectory: p.isDirectory === 'true',
      size: p.contentLength,
      lastModified: p.lastModified,
    }));
  }
}

// Singleton instance - will be initialized with MSAL instance
let fabricServiceInstance: FabricService | null = null;

export function initFabricService(msalInstance: IPublicClientApplication): FabricService {
  fabricServiceInstance = new FabricService(msalInstance);
  return fabricServiceInstance;
}

export function getFabricService(): FabricService {
  if (!fabricServiceInstance) {
    throw new Error('FabricService not initialized. Call initFabricService first.');
  }
  return fabricServiceInstance;
}
