/**
 * NamespacePanel Component
 * 
 * Displays detected namespaces from RDF files with classification
 * (external, well-known, etc.) and allows selecting which to fetch.
 */

import {
  makeStyles,
  tokens,
  Card,
  Title3,
  Body1,
  Body2,
  Badge,
  Spinner,
  Button,
  Tooltip,
} from '@fluentui/react-components';
import {
  Globe24Regular,
  Library24Regular,
  Link24Regular,
  ArrowDownload24Regular,
  Info16Regular,
  ArrowSync24Regular,
} from '@fluentui/react-icons';
import type { DetectedNamespace } from '../services/namespaceDetector';
import { getNamespaceStats } from '../services/namespaceDetector';

const useStyles = makeStyles({
  container: {
    marginTop: '16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  stats: {
    display: 'flex',
    gap: '12px',
    fontSize: '13px',
    color: tokens.colorNeutralForeground3,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  namespaceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground2,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  prefix: {
    fontFamily: 'monospace',
    fontWeight: 600,
    minWidth: '80px',
  },
  uri: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  externalRow: {
    borderLeft: `3px solid ${tokens.colorPaletteGreenBorder2}`,
  },
  wellKnownRow: {
    borderLeft: `3px solid ${tokens.colorNeutralStroke2}`,
    opacity: 0.7,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
  },
  empty: {
    padding: '16px',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
  fetchButton: {
    marginTop: '12px',
  },
  badge: {
    fontSize: '11px',
  },
});

interface NamespacePanelProps {
  namespaces: DetectedNamespace[] | undefined;
  isLoading?: boolean;
  onRefresh?: () => void;
  onFetchSelected?: (uris: string[]) => void;
}

export function NamespacePanel({ namespaces, isLoading, onRefresh, onFetchSelected }: NamespacePanelProps) {
  const styles = useStyles();
  
  if (isLoading) {
    return (
      <Card className={styles.container}>
        <div className={styles.loading}>
          <Spinner size="small" />
          <Body1>Detecting namespaces...</Body1>
        </div>
      </Card>
    );
  }
  
  if (!namespaces || namespaces.length === 0) {
    return (
      <Card className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <Globe24Regular />
            <Title3>Detected Namespaces</Title3>
          </div>
          {onRefresh && (
            <Button 
              appearance="subtle" 
              icon={<ArrowSync24Regular />}
              onClick={onRefresh}
              title="Detect namespaces"
            />
          )}
        </div>
        <div className={styles.empty}>
          <Body1>No namespaces detected yet.</Body1>
          <Body2>Add RDF files to detect external ontology references.</Body2>
        </div>
      </Card>
    );
  }
  
  const stats = getNamespaceStats(namespaces);
  const externalNamespaces = namespaces.filter(ns => ns.isExternal);
  const wellKnownNamespaces = namespaces.filter(ns => ns.isWellKnown);
  const localNamespaces = namespaces.filter(ns => !ns.isExternal && !ns.isWellKnown);
  
  return (
    <Card className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Globe24Regular />
          <Title3>Detected Namespaces</Title3>
          <Badge appearance="filled" color="informative" className={styles.badge}>
            {stats.total}
          </Badge>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className={styles.stats}>
            <span>{stats.external} external</span>
            <span>·</span>
            <span>{stats.wellKnown} standard</span>
          </div>
          {onRefresh && (
            <Button 
              appearance="subtle" 
              icon={<ArrowSync24Regular />}
              onClick={onRefresh}
              title="Re-detect namespaces"
            />
          )}
        </div>
      </div>
      
      <div className={styles.list}>
        {/* External namespaces first - these are fetchable */}
        {externalNamespaces.length > 0 && (
          <>
            <Body2 style={{ padding: '4px 0', fontWeight: 600, color: tokens.colorPaletteGreenForeground2 }}>
              <Globe24Regular style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              External Ontologies ({externalNamespaces.length})
            </Body2>
            {externalNamespaces.map(ns => (
              <NamespaceRow key={ns.uri} namespace={ns} styles={styles} />
            ))}
          </>
        )}
        
        {/* Local namespaces */}
        {localNamespaces.length > 0 && (
          <>
            <Body2 style={{ padding: '8px 0 4px', fontWeight: 600 }}>
              <Link24Regular style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Local ({localNamespaces.length})
            </Body2>
            {localNamespaces.map(ns => (
              <NamespaceRow key={ns.uri} namespace={ns} styles={styles} />
            ))}
          </>
        )}
        
        {/* Well-known standard namespaces */}
        {wellKnownNamespaces.length > 0 && (
          <>
            <Body2 style={{ padding: '8px 0 4px', fontWeight: 600, color: tokens.colorNeutralForeground3 }}>
              <Library24Regular style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Standard ({wellKnownNamespaces.length})
            </Body2>
            {wellKnownNamespaces.map(ns => (
              <NamespaceRow key={ns.uri} namespace={ns} styles={styles} />
            ))}
          </>
        )}
      </div>
      
      {/* Future: Fetch button for external ontologies */}
      {externalNamespaces.length > 0 && onFetchSelected && (
        <Button
          appearance="outline"
          icon={<ArrowDownload24Regular />}
          className={styles.fetchButton}
          disabled
          title="Coming soon: Fetch external ontologies"
        >
          Fetch External Ontologies ({externalNamespaces.length})
        </Button>
      )}
    </Card>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NamespaceRow({ namespace, styles }: { namespace: DetectedNamespace; styles: any }) {
  const rowClass = `${styles.namespaceRow} ${
    namespace.isExternal ? styles.externalRow : 
    namespace.isWellKnown ? styles.wellKnownRow : ''
  }`;
  
  return (
    <div className={rowClass}>
      <span className={styles.prefix}>{namespace.prefix || '(default)'}</span>
      <span className={styles.uri} title={namespace.uri}>{namespace.uri}</span>
      {namespace.description && (
        <Tooltip content={namespace.description} relationship="label">
          <Info16Regular style={{ color: tokens.colorNeutralForeground3 }} />
        </Tooltip>
      )}
    </div>
  );
}
