import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DetectedNamespace } from '../services/namespaceDetector';

export interface Project {
  id: string;
  name: string;
  created: string;
  updated: string;
  source: {
    files: string[];
    schemaFiles: string[];
  };
  schemaLevel: number | null;
  decisions: Record<string, unknown>;
  status: 'draft' | 'configured' | 'translated' | 'loaded';
  detectedNamespaces?: DetectedNamespace[];
}

// Pipeline execution state (not persisted - runtime only)
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface StepState {
  status: StepStatus;
  jobId?: string;
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface PipelineExecution {
  projectId: string;
  isRunning: boolean;
  overallStatus: 'idle' | 'running' | 'completed' | 'failed';
  stepStates: Record<string, StepState>;
  logs: string[];
  errorMessage: string | null;
  lastUpdated: number; // Timestamp of last update (for stale state detection)
}

interface AppState {
  // Workspace configuration
  workspaceUrl: string | null;
  workspaceId: string | null;
  lakehouseId: string | null;

  // Loading state
  isLoading: boolean;

  // Projects
  projects: Project[];
  currentProjectId: string | null;

  // Pipeline execution (runtime, not persisted)
  pipelineExecution: PipelineExecution | null;

  // Actions
  setWorkspace: (url: string, workspaceId: string, lakehouseId: string) => void;
  clearWorkspace: () => void;
  setLoading: (loading: boolean) => void;
  
  // Project actions
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  setCurrentProject: (id: string | null) => void;
  getCurrentProject: () => Project | null;

  // Pipeline execution actions
  startPipelineExecution: (projectId: string) => void;
  updatePipelineStep: (stepId: string, update: Partial<StepState>) => void;
  addPipelineLog: (message: string) => void;
  setPipelineStatus: (status: 'idle' | 'running' | 'completed' | 'failed', errorMessage?: string | null) => void;
  clearPipelineExecution: () => void;
  getPipelineExecution: (projectId: string) => PipelineExecution | null;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      workspaceUrl: null,
      workspaceId: null,
      lakehouseId: null,
      isLoading: false,
      projects: [],
      currentProjectId: null,
      pipelineExecution: null,

      // Workspace actions
      setWorkspace: (url, workspaceId, lakehouseId) =>
        set({ workspaceUrl: url, workspaceId, lakehouseId }),
      
      clearWorkspace: () =>
        set({ workspaceUrl: null, workspaceId: null, lakehouseId: null }),

      setLoading: (loading) => set({ isLoading: loading }),

      // Project actions
      addProject: (project) =>
        set((state) => ({ projects: [...state.projects, project] })),

      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates, updated: new Date().toISOString() } : p
          ),
        })),

      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
        })),

      setCurrentProject: (id) => set({ currentProjectId: id }),

      getCurrentProject: () => {
        const state = get();
        return state.projects.find((p) => p.id === state.currentProjectId) || null;
      },

      // Pipeline execution actions
      startPipelineExecution: (projectId) =>
        set({
          pipelineExecution: {
            projectId,
            isRunning: true,
            overallStatus: 'running',
            stepStates: {},
            logs: [],
            errorMessage: null,
            lastUpdated: Date.now(),
          },
        }),

      updatePipelineStep: (stepId, update) =>
        set((state) => {
          if (!state.pipelineExecution) return state;
          return {
            pipelineExecution: {
              ...state.pipelineExecution,
              lastUpdated: Date.now(),
              stepStates: {
                ...state.pipelineExecution.stepStates,
                [stepId]: {
                  ...state.pipelineExecution.stepStates[stepId],
                  ...update,
                },
              },
            },
          };
        }),

      addPipelineLog: (message) =>
        set((state) => {
          if (!state.pipelineExecution) return state;
          const timestamp = new Date().toLocaleTimeString();
          return {
            pipelineExecution: {
              ...state.pipelineExecution,
              lastUpdated: Date.now(),
              logs: [...state.pipelineExecution.logs, `[${timestamp}] ${message}`],
            },
          };
        }),

      setPipelineStatus: (status, errorMessage = null) =>
        set((state) => {
          if (!state.pipelineExecution) return state;
          return {
            pipelineExecution: {
              ...state.pipelineExecution,
              isRunning: status === 'running',
              overallStatus: status,
              errorMessage,
              lastUpdated: Date.now(),
            },
          };
        }),

      clearPipelineExecution: () => set({ pipelineExecution: null }),

      getPipelineExecution: (projectId) => {
        const state = get();
        if (state.pipelineExecution?.projectId === projectId) {
          return state.pipelineExecution;
        }
        return null;
      },
    }),
    {
      name: 'rdf2fabric-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        workspaceUrl: state.workspaceUrl,
        workspaceId: state.workspaceId,
        lakehouseId: state.lakehouseId,
        projects: state.projects,
        // Persist pipeline execution so it survives refresh/navigation
        pipelineExecution: state.pipelineExecution,
      }),
    }
  )
);
