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

export interface NotebookJob {
  id: string;
  itemId: string;
  jobType: string;
  invokeType: string;
  status: 'NotStarted' | 'InProgress' | 'Completed' | 'Failed' | 'Cancelled' | 'Deduped';
  startTimeUtc?: string;
  endTimeUtc?: string;
  failureReason?: {
    message: string;
    errorCode?: string;
  };
}

export interface FabricFolder {
  id: string;
  displayName: string;
  workspaceId: string;
  parentFolderId?: string;
}

export interface PipelineConfig {
  project_name: string;
  folder_id: string | null;
  created_at: string;
  created_by: 'app' | 'manual';
  source: {
    files: string[];
    schema_level: number | null;
  };
  decisions: Record<string, string>;
}

export interface PipelineProgress {
  current: string | null;  // Currently running step ID (e.g., 'NB03') or null if complete
  completed: string[];     // List of completed step IDs
  status: 'running' | 'completed' | 'failed';
  error: string | null;
  step_times: Record<string, {
    start: string;
    end: string;
    duration_sec: number;
    error?: string;
  }>;
  total_steps: number;
  updated_at: string;
}

export interface TranslationStep {
  id: string;
  name: string;
  notebookName: string;
  description: string;
}

// Pipeline steps - notebooks to run in order
export const TRANSLATION_PIPELINE: TranslationStep[] = [
  { id: 'NB01', name: 'Parse RDF', notebookName: '01_rdf_parser_jena', description: 'Parse RDF files with Apache Jena' },
  { id: 'NB02', name: 'Detect Schema', notebookName: '02_schema_detector', description: 'Detect schema richness level' },
  { id: 'NB03', name: 'Map Classes', notebookName: '03_class_to_nodetype', description: 'Map RDF classes to node types' },
  { id: 'NB04', name: 'Map Properties', notebookName: '04_property_mapping', description: 'Map RDF properties to edges/properties' },
  { id: 'NB05', name: 'Translate Instances', notebookName: '05_instance_translator', description: 'Translate RDF instances to nodes' },
  { id: 'NB06', name: 'Write Delta Tables', notebookName: '06_delta_writer', description: 'Write gold Delta tables' },
  { id: 'NB07', name: 'Generate Ontology', notebookName: '07_ontology_definition_generator', description: 'Generate Fabric Ontology JSON' },
  { id: 'NB08', name: 'Push to API', notebookName: '08_ontology_api_client', description: 'Push definition to Ontology API' },
  { id: 'NB09', name: 'Bind to Graph', notebookName: '09_data_binding', description: 'Bind tables to GraphModel' },
];

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

  /**
   * Create a folder in a workspace
   * https://learn.microsoft.com/en-us/rest/api/fabric/core/folders/create-folder
   */
  async createFolder(
    workspaceId: string,
    displayName: string,
    parentFolderId?: string
  ): Promise<FabricFolder> {
    const body: { displayName: string; parentFolderId?: string } = { displayName };
    if (parentFolderId) {
      body.parentFolderId = parentFolderId;
    }

    const response = await this.fetchFabric<FabricFolder>(
      `/workspaces/${workspaceId}/folders`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
    return response;
  }

  /**
   * List folders in a workspace
   */
  async listFolders(workspaceId: string): Promise<FabricFolder[]> {
    const response = await this.fetchFabric<{ value: FabricFolder[] }>(
      `/workspaces/${workspaceId}/folders`
    );
    return response.value;
  }

  /**
   * Find or create a folder by name
   */
  async findOrCreateFolder(workspaceId: string, displayName: string): Promise<FabricFolder> {
    // First, try to find existing folder
    const folders = await this.listFolders(workspaceId);
    const existing = folders.find(f => f.displayName === displayName);
    if (existing) {
      return existing;
    }
    // Create new folder
    return this.createFolder(workspaceId, displayName);
  }

  /**
   * Create a directory in OneLake
   */
  async createOneLakeDirectory(
    workspaceId: string,
    lakehouseId: string,
    path: string
  ): Promise<void> {
    const token = await this.getAccessToken(fabricScopes.storage);
    const dfsBase = 'https://onelake.dfs.fabric.microsoft.com';
    const fullPath = `/${workspaceId}/${lakehouseId}/Files/${path}`;

    const response = await fetch(
      `${dfsBase}${fullPath}?resource=directory`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok && response.status !== 409) { // 409 = already exists, that's ok
      throw new Error(`OneLake error (${response.status}): ${await response.text()}`);
    }
  }

  /**
   * Write a file to OneLake
   */
  async writeOneLakeFile(
    workspaceId: string,
    lakehouseId: string,
    path: string,
    content: string
  ): Promise<void> {
    const token = await this.getAccessToken(fabricScopes.storage);
    const dfsBase = 'https://onelake.dfs.fabric.microsoft.com';
    const fullPath = `/${workspaceId}/${lakehouseId}/Files/${path}`;

    // Create file
    const createResponse = await fetch(
      `${dfsBase}${fullPath}?resource=file`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!createResponse.ok) {
      throw new Error(`OneLake create error (${createResponse.status}): ${await createResponse.text()}`);
    }

    // Write content
    const contentBytes = new TextEncoder().encode(content);
    const appendResponse = await fetch(
      `${dfsBase}${fullPath}?action=append&position=0`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
        },
        body: contentBytes,
      }
    );

    if (!appendResponse.ok) {
      throw new Error(`OneLake append error (${appendResponse.status}): ${await appendResponse.text()}`);
    }

    // Flush to complete write
    const flushResponse = await fetch(
      `${dfsBase}${fullPath}?action=flush&position=${contentBytes.length}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!flushResponse.ok) {
      throw new Error(`OneLake flush error (${flushResponse.status}): ${await flushResponse.text()}`);
    }
  }

  /**
   * Write pipeline configuration to OneLake
   * This config file is read by all notebooks to get project settings
   */
  async writePipelineConfig(
    workspaceId: string,
    lakehouseId: string,
    config: PipelineConfig
  ): Promise<void> {
    // Ensure config directory exists
    await this.createOneLakeDirectory(workspaceId, lakehouseId, 'config');

    // Write config file
    const configJson = JSON.stringify(config, null, 2);
    await this.writeOneLakeFile(
      workspaceId,
      lakehouseId,
      'config/pipeline_run.json',
      configJson
    );
  }

  /**
   * List notebooks in a workspace
   */
  async listNotebooks(workspaceId: string): Promise<FabricItem[]> {
    return this.listItems(workspaceId, 'Notebook');
  }

  /**
   * Run a notebook job
   * Returns job info from 202 Accepted response
   */
  async runNotebook(workspaceId: string, notebookId: string): Promise<NotebookJob> {
    const token = await this.getAccessToken();
    const endpoint = `/workspaces/${workspaceId}/items/${notebookId}/jobs/instances?jobType=RunNotebook`;
    
    const response = await fetch(`${FABRIC_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fabric API error (${response.status}): ${errorText}`);
    }

    // 202 Accepted - extract job ID from Location header
    // Location format: /workspaces/{wsId}/items/{itemId}/jobs/instances/{jobId}
    const location = response.headers.get('Location');
    if (location) {
      const jobIdMatch = location.match(/instances\/([a-f0-9-]+)/i);
      if (jobIdMatch) {
        return {
          id: jobIdMatch[1],
          itemId: notebookId,
          jobType: 'RunNotebook',
          invokeType: 'Manual',
          status: 'NotStarted',
        };
      }
    }

    // Try to parse body if present
    const text = await response.text();
    if (text) {
      return JSON.parse(text);
    }

    throw new Error('No job ID returned from notebook execution');
  }

  /**
   * Get job status
   */
  async getJobStatus(workspaceId: string, itemId: string, jobId: string): Promise<NotebookJob> {
    return this.fetchFabric<NotebookJob>(
      `/workspaces/${workspaceId}/items/${itemId}/jobs/instances/${jobId}`
    );
  }

  /**
   * Poll job until completion
   */
  async waitForJob(
    workspaceId: string,
    itemId: string,
    jobId: string,
    onProgress?: (job: NotebookJob) => void,
    pollIntervalMs: number = 5000,
    timeoutMs: number = 600000 // 10 minutes
  ): Promise<NotebookJob> {
    const startTime = Date.now();
    
    while (true) {
      const job = await this.getJobStatus(workspaceId, itemId, jobId);
      
      if (onProgress) {
        onProgress(job);
      }

      if (job.status === 'Completed' || job.status === 'Failed' || job.status === 'Cancelled') {
        return job;
      }

      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Job timed out after ${timeoutMs / 1000} seconds`);
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
  }

  /**
   * Find notebook by display name
   */
  async findNotebookByName(workspaceId: string, displayName: string): Promise<FabricItem | undefined> {
    const notebooks = await this.listNotebooks(workspaceId);
    return notebooks.find(nb => nb.displayName === displayName);
  }

  /**
   * Read a file from OneLake
   */
  async readOneLakeFile(
    workspaceId: string,
    lakehouseId: string,
    path: string
  ): Promise<string | null> {
    const token = await this.getAccessToken(fabricScopes.storage);
    const dfsBase = 'https://onelake.dfs.fabric.microsoft.com';
    const fullPath = `/${workspaceId}/${lakehouseId}/Files/${path}`;

    const response = await fetch(`${dfsBase}${fullPath}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 404) {
      return null; // File doesn't exist yet
    }

    if (!response.ok) {
      throw new Error(`OneLake read error (${response.status}): ${await response.text()}`);
    }

    return response.text();
  }

  /**
   * Read pipeline progress from OneLake
   * Returns null if no progress file exists yet
   */
  async readPipelineProgress(
    workspaceId: string,
    lakehouseId: string
  ): Promise<PipelineProgress | null> {
    const content = await this.readOneLakeFile(
      workspaceId,
      lakehouseId,
      'config/pipeline_progress.json'
    );

    if (!content) {
      return null;
    }

    return JSON.parse(content) as PipelineProgress;
  }

  /**
   * Run the pipeline orchestrator notebook
   * This triggers all notebooks server-side - no browser polling needed
   */
  async runOrchestrator(workspaceId: string): Promise<NotebookJob> {
    const orchestrator = await this.findNotebookByName(workspaceId, '00_pipeline_orchestrator');
    if (!orchestrator) {
      throw new Error('Orchestrator notebook (00_pipeline_orchestrator) not found in workspace');
    }
    return this.runNotebook(workspaceId, orchestrator.id);
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
