import { useState, useEffect } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import {
  makeStyles,
  tokens,
  Card,
  Title2,
  Title3,
  Body1,
  Button,
  Dropdown,
  Option,
  Field,
  MessageBar,
  MessageBarBody,
  Spinner,
} from '@fluentui/react-components';
import {
  Checkmark24Regular,
  Warning24Regular,
  Link24Regular,
  ArrowSync24Regular,
} from '@fluentui/react-icons';
import { useAppStore } from '../stores/appStore';
import { FabricService, FabricWorkspace, FabricLakehouse } from '../services/fabricService';

const useStyles = makeStyles({
  container: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  card: {
    padding: '24px',
    marginBottom: '24px',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    maxWidth: '500px',
  },
  buttonRow: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px',
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  connected: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    color: tokens.colorPaletteGreenForeground1,
  },
  disconnected: {
    backgroundColor: tokens.colorPaletteYellowBackground1,
    color: tokens.colorPaletteYellowForeground1,
  },
});

export function SettingsPage() {
  const styles = useStyles();
  const isAuthenticated = useIsAuthenticated();
  const { instance } = useMsal();
  const { workspaceId, lakehouseId, setWorkspace, clearWorkspace } = useAppStore();

  // State
  const [workspaces, setWorkspaces] = useState<FabricWorkspace[]>([]);
  const [lakehouses, setLakehouses] = useState<FabricLakehouse[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(workspaceId || '');
  const [selectedLakehouseId, setSelectedLakehouseId] = useState<string>(lakehouseId || '');
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [isLoadingLakehouses, setIsLoadingLakehouses] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isConnected = Boolean(workspaceId && lakehouseId);
  const fabricService = isAuthenticated ? new FabricService(instance) : null;

  // Load workspaces when authenticated
  useEffect(() => {
    if (isAuthenticated && fabricService) {
      loadWorkspaces();
    }
  }, [isAuthenticated]);

  // Load lakehouses when workspace selected
  useEffect(() => {
    if (selectedWorkspaceId && fabricService) {
      loadLakehouses(selectedWorkspaceId);
    } else {
      setLakehouses([]);
      setSelectedLakehouseId('');
    }
  }, [selectedWorkspaceId]);

  const loadWorkspaces = async () => {
    if (!fabricService) return;
    setIsLoadingWorkspaces(true);
    setError(null);
    try {
      const ws = await fabricService.listWorkspaces();
      setWorkspaces(ws);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setIsLoadingWorkspaces(false);
    }
  };

  const loadLakehouses = async (wsId: string) => {
    if (!fabricService) return;
    setIsLoadingLakehouses(true);
    setError(null);
    try {
      const lh = await fabricService.listLakehouses(wsId);
      setLakehouses(lh);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lakehouses');
    } finally {
      setIsLoadingLakehouses(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      if (!selectedWorkspaceId) {
        throw new Error('Please select a workspace');
      }
      if (!selectedLakehouseId) {
        throw new Error('Please select a lakehouse');
      }

      const workspace = workspaces.find(w => w.id === selectedWorkspaceId);
      const workspaceUrl = `https://app.fabric.microsoft.com/groups/${selectedWorkspaceId}`;
      
      setWorkspace(workspaceUrl, selectedWorkspaceId, selectedLakehouseId);
      setSuccessMessage(`Connected to ${workspace?.displayName || 'workspace'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = () => {
    clearWorkspace();
    setSelectedWorkspaceId('');
    setSelectedLakehouseId('');
    setSuccessMessage(null);
  };

  const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId);
  const selectedLakehouse = lakehouses.find(l => l.id === selectedLakehouseId);

  return (
    <div className={styles.container}>
      <Title2 style={{ marginBottom: '24px' }}>Settings</Title2>

      {!isAuthenticated && (
        <MessageBar intent="warning" style={{ marginBottom: '24px' }}>
          <MessageBarBody>
            Sign in to configure your Fabric workspace connection.
          </MessageBarBody>
        </MessageBar>
      )}

      <Card className={styles.card}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <Link24Regular />
            <Title3>Fabric Workspace Connection</Title3>
          </div>

          <div
            className={`${styles.status} ${
              isConnected ? styles.connected : styles.disconnected
            }`}
          >
            {isConnected ? (
              <>
                <Checkmark24Regular />
                <Body1>Connected to workspace</Body1>
              </>
            ) : (
              <>
                <Warning24Regular />
                <Body1>Not connected</Body1>
              </>
            )}
          </div>
        </div>

        {error && (
          <MessageBar intent="error" style={{ marginBottom: '16px' }}>
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        {successMessage && (
          <MessageBar intent="success" style={{ marginBottom: '16px' }}>
            <MessageBarBody>{successMessage}</MessageBarBody>
          </MessageBar>
        )}

        <div className={styles.form}>
          <Field label="Workspace" required>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <Dropdown
                placeholder="Select a workspace"
                value={selectedWorkspace?.displayName || ''}
                selectedOptions={selectedWorkspaceId ? [selectedWorkspaceId] : []}
                onOptionSelect={(_, data) => setSelectedWorkspaceId(data.optionValue as string || '')}
                disabled={!isAuthenticated || isLoadingWorkspaces}
                style={{ flex: 1 }}
              >
                {workspaces.map((ws) => (
                  <Option key={ws.id} value={ws.id}>
                    {ws.displayName}
                  </Option>
                ))}
              </Dropdown>
              <Button
                icon={isLoadingWorkspaces ? <Spinner size="tiny" /> : <ArrowSync24Regular />}
                onClick={loadWorkspaces}
                disabled={!isAuthenticated || isLoadingWorkspaces}
                title="Refresh workspaces"
              />
            </div>
          </Field>

          <Field label="Lakehouse" required>
            <Dropdown
              placeholder={selectedWorkspaceId ? "Select a lakehouse" : "Select a workspace first"}
              value={selectedLakehouse?.displayName || ''}
              selectedOptions={selectedLakehouseId ? [selectedLakehouseId] : []}
              onOptionSelect={(_, data) => setSelectedLakehouseId(data.optionValue as string || '')}
              disabled={!isAuthenticated || !selectedWorkspaceId || isLoadingLakehouses}
            >
              {lakehouses.map((lh) => (
                <Option key={lh.id} value={lh.id}>
                  {lh.displayName}
                </Option>
              ))}
            </Dropdown>
            {isLoadingLakehouses && <Spinner size="tiny" style={{ marginTop: '4px' }} />}
          </Field>

          <div className={styles.buttonRow}>
            <Button
              appearance="primary"
              onClick={handleSave}
              disabled={!isAuthenticated || !selectedWorkspaceId || !selectedLakehouseId || isSaving}
              icon={isSaving ? <Spinner size="tiny" /> : undefined}
            >
              {isSaving ? 'Saving...' : 'Save Connection'}
            </Button>
            {isConnected && (
              <Button appearance="secondary" onClick={handleDisconnect}>
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className={styles.card}>
        <div className={styles.section}>
          <Title3>Connection Info</Title3>
          <Body1 style={{ marginTop: '12px' }}>
            <p>Select your Fabric workspace and lakehouse from the dropdowns above.</p>
            <p style={{ marginTop: '8px' }}>
              The lakehouse should contain your RDF source files in the <code>Files/</code> folder
              and will store the translated graph data in Delta tables.
            </p>
          </Body1>
        </div>
      </Card>
    </div>
  );
}
