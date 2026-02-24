import { describe, test, expect, beforeEach } from 'vitest';
import { useAppStore, Project } from '../stores/appStore';

describe('appStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({
      workspaceUrl: null,
      workspaceId: null,
      lakehouseId: null,
      isLoading: false,
      projects: [],
      currentProjectId: null,
    });
  });

  describe('workspace configuration', () => {
    test('setWorkspace stores workspace details', () => {
      const { setWorkspace } = useAppStore.getState();
      
      setWorkspace('https://example.com', 'ws-123', 'lh-456');
      
      const state = useAppStore.getState();
      expect(state.workspaceUrl).toBe('https://example.com');
      expect(state.workspaceId).toBe('ws-123');
      expect(state.lakehouseId).toBe('lh-456');
    });

    test('clearWorkspace removes workspace details', () => {
      const { setWorkspace, clearWorkspace } = useAppStore.getState();
      
      setWorkspace('https://example.com', 'ws-123', 'lh-456');
      clearWorkspace();
      
      const state = useAppStore.getState();
      expect(state.workspaceUrl).toBeNull();
      expect(state.workspaceId).toBeNull();
      expect(state.lakehouseId).toBeNull();
    });
  });

  describe('project management', () => {
    const mockProject: Project = {
      id: 'test-project-1',
      name: 'Test Project',
      created: '2026-02-24T00:00:00Z',
      updated: '2026-02-24T00:00:00Z',
      source: { files: [], schemaFiles: [] },
      schemaLevel: null,
      decisions: {},
      status: 'draft',
    };

    test('addProject adds a new project', () => {
      const { addProject } = useAppStore.getState();
      
      addProject(mockProject);
      
      const state = useAppStore.getState();
      expect(state.projects).toHaveLength(1);
      expect(state.projects[0].id).toBe('test-project-1');
    });

    test('updateProject updates existing project', () => {
      const { addProject, updateProject } = useAppStore.getState();
      
      addProject(mockProject);
      updateProject('test-project-1', { name: 'Updated Name', status: 'configured' });
      
      const state = useAppStore.getState();
      expect(state.projects[0].name).toBe('Updated Name');
      expect(state.projects[0].status).toBe('configured');
    });

    test('deleteProject removes project', () => {
      const { addProject, deleteProject } = useAppStore.getState();
      
      addProject(mockProject);
      deleteProject('test-project-1');
      
      const state = useAppStore.getState();
      expect(state.projects).toHaveLength(0);
    });

    test('deleteProject clears currentProjectId if deleted', () => {
      const { addProject, setCurrentProject, deleteProject } = useAppStore.getState();
      
      addProject(mockProject);
      setCurrentProject('test-project-1');
      deleteProject('test-project-1');
      
      const state = useAppStore.getState();
      expect(state.currentProjectId).toBeNull();
    });

    test('getCurrentProject returns current project', () => {
      const { addProject, setCurrentProject, getCurrentProject } = useAppStore.getState();
      
      addProject(mockProject);
      setCurrentProject('test-project-1');
      
      const current = getCurrentProject();
      expect(current?.id).toBe('test-project-1');
    });

    test('getCurrentProject returns null when no project selected', () => {
      const { getCurrentProject } = useAppStore.getState();
      
      const current = getCurrentProject();
      expect(current).toBeNull();
    });
  });
});
