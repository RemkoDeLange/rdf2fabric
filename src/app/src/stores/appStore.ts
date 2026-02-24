import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
    }),
    {
      name: 'rdf2fabric-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        workspaceUrl: state.workspaceUrl,
        workspaceId: state.workspaceId,
        lakehouseId: state.lakehouseId,
        projects: state.projects,
      }),
    }
  )
);
