import { useState } from 'react';
import { useIsAuthenticated } from '@azure/msal-react';
import {
  makeStyles,
  tokens,
  Card,
  Title2,
  Title3,
  Body1,
  Button,
  Input,
  Field,
  MessageBar,
  MessageBarBody,
  Spinner,
} from '@fluentui/react-components';
import {
  Checkmark24Regular,
  Warning24Regular,
  Link24Regular,
} from '@fluentui/react-icons';
import { useAppStore } from '../stores/appStore';

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
  const { workspaceUrl, workspaceId, lakehouseId, setWorkspace, clearWorkspace } = useAppStore();

  const [inputUrl, setInputUrl] = useState(workspaceUrl || '');
  const [inputWorkspaceId, setInputWorkspaceId] = useState(workspaceId || '');
  const [inputLakehouseId, setInputLakehouseId] = useState(lakehouseId || '');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = Boolean(workspaceUrl && workspaceId && lakehouseId);

  const handleSave = async () => {
    setError(null);
    setIsValidating(true);

    try {
      // Basic validation
      if (!inputUrl.trim()) {
        throw new Error('Workspace URL is required');
      }
      if (!inputWorkspaceId.trim()) {
        throw new Error('Workspace ID is required');
      }
      if (!inputLakehouseId.trim()) {
        throw new Error('Lakehouse ID is required');
      }

      // TODO: Validate connection to Fabric API
      // For now, just save
      setWorkspace(inputUrl.trim(), inputWorkspaceId.trim(), inputLakehouseId.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDisconnect = () => {
    clearWorkspace();
    setInputUrl('');
    setInputWorkspaceId('');
    setInputLakehouseId('');
  };

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

        <div className={styles.form}>
          <Field label="Workspace URL" required>
            <Input
              value={inputUrl}
              onChange={(_, data) => setInputUrl(data.value)}
              placeholder="https://app.fabric.microsoft.com/groups/..."
              disabled={!isAuthenticated}
            />
          </Field>

          <Field label="Workspace ID" required hint="GUID from workspace URL">
            <Input
              value={inputWorkspaceId}
              onChange={(_, data) => setInputWorkspaceId(data.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              disabled={!isAuthenticated}
            />
          </Field>

          <Field label="Lakehouse ID" required hint="GUID of the lakehouse to use">
            <Input
              value={inputLakehouseId}
              onChange={(_, data) => setInputLakehouseId(data.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              disabled={!isAuthenticated}
            />
          </Field>

          <div className={styles.buttonRow}>
            <Button
              appearance="primary"
              onClick={handleSave}
              disabled={!isAuthenticated || isValidating}
              icon={isValidating ? <Spinner size="tiny" /> : undefined}
            >
              {isValidating ? 'Validating...' : 'Save'}
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
          <Title3>How to find your IDs</Title3>
          <Body1 style={{ marginTop: '12px' }}>
            <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
              <li>Open your Fabric workspace in the browser</li>
              <li>
                The <strong>Workspace ID</strong> is in the URL after{' '}
                <code>/groups/</code>
              </li>
              <li>
                Open your Lakehouse and find the <strong>Lakehouse ID</strong> in
                the URL after <code>/lakehouses/</code>
              </li>
            </ol>
          </Body1>
        </div>
      </Card>
    </div>
  );
}
