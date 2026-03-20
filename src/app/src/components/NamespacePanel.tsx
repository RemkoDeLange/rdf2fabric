/**
 * NamespacePanel Component
 * 
 * Displays detected namespaces from RDF files with classification
 * (external, well-known, etc.) and allows selecting which to queue for fetching.
 * 
 * Fetching is done via notebook (12_external_ontology_fetcher.ipynb) to avoid CORS.
 */

import { useState } from 'react';
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
  Checkbox,
} from '@fluentui/react-components';
import {
  Globe24Regular,
  Library24Regular,
  Link24Regular,
  DocumentQueue24Regular,
  Info16Regular,
  ArrowSync24Regular,
  CheckmarkCircle16Regular,
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
  fetchSection: {
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fetchControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  successMessage: {
    marginTop: '8px',
    padding: '8px 12px',
    backgroundColor: tokens.colorPaletteGreenBackground1,
    borderRadius: tokens.borderRadiusSmall,
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  badge: {
    fontSize: '11px',
  },
});

interface NamespacePanelProps {
  namespaces: DetectedNamespace[] | undefined;
  isLoading?: boolean;
  onRefresh?: () => void;
  onQueueForFetch?: (uris: string[]) => Promise<boolean>;
}

export function NamespacePanel({ namespaces, isLoading, onRefresh, onQueueForFetch }: NamespacePanelProps) {
  const styles = useStyles();
  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());
  const [isQueuing, setIsQueuing] = useState(false);
  const [queueSuccess, setQueueSuccess] = useState(false);
  
  // Get external namespaces that can be fetched
  const externalNamespaces = namespaces?.filter(ns => ns.isExternal) || [];
  
  // Toggle selection for a single namespace
  const toggleSelection = (uri: string) => {
    setSelectedUris(prev => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  };
  
  // Select/deselect all external namespaces
  const toggleSelectAll = () => {
    if (selectedUris.size === externalNamespaces.length) {
      setSelectedUris(new Set());
    } else {
      setSelectedUris(new Set(externalNamespaces.map(ns => ns.uri)));
    }
  };
  
  // Handle queue button click - writes manifest to OneLake for notebook to process
  const handleQueue = async () => {
    if (!onQueueForFetch || selectedUris.size === 0) return;
    
    setIsQueuing(true);
    setQueueSuccess(false);
    
    try {
      const success = await onQueueForFetch(Array.from(selectedUris));
      if (success) {
        setQueueSuccess(true);
        setSelectedUris(new Set()); // Clear selection after queuing
      }
    } finally {
      setIsQueuing(false);
    }
  };
  
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
              disabled={isQueuing}
            />
          )}
        </div>
      </div>
      
      <div className={styles.list}>
        {/* External namespaces first - these are fetchable */}
        {externalNamespaces.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
              {onQueueForFetch && (
                <Checkbox
                  checked={selectedUris.size === externalNamespaces.length ? true : selectedUris.size > 0 ? 'mixed' : false}
                  onChange={toggleSelectAll}
                  disabled={isQueuing}
                />
              )}
              <Body2 style={{ fontWeight: 600, color: tokens.colorPaletteGreenForeground2 }}>
                <Globe24Regular style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                External Ontologies ({externalNamespaces.length})
              </Body2>
            </div>
            {externalNamespaces.map(ns => (
              <NamespaceRow 
                key={ns.uri} 
                namespace={ns} 
                styles={styles}
                selectable={!!onQueueForFetch}
                selected={selectedUris.has(ns.uri)}
                onToggle={() => toggleSelection(ns.uri)}
                disabled={isQueuing}
              />
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
      
      {/* Queue for fetch section */}
      {externalNamespaces.length > 0 && onQueueForFetch && (
        <div className={styles.fetchSection}>
          <div className={styles.fetchControls}>
            <Button
              appearance="outline"
              icon={isQueuing ? <Spinner size="tiny" /> : <DocumentQueue24Regular />}
              onClick={handleQueue}
              disabled={isQueuing || selectedUris.size === 0}
            >
              {isQueuing 
                ? 'Writing manifest...' 
                : `Queue for Notebook (${selectedUris.size})`}
            </Button>
          </div>
          
          {/* Success message */}
          {queueSuccess && (
            <div className={styles.successMessage}>
              <CheckmarkCircle16Regular />
              <span>
                Manifest saved to <code>Files/cache/fetch_manifest.json</code>. 
                Run <code>12_external_ontology_fetcher.ipynb</code> in Fabric to fetch.
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

interface NamespaceRowProps {
  namespace: DetectedNamespace;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  styles: any;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
}

function NamespaceRow({ 
  namespace, 
  styles, 
  selectable, 
  selected, 
  onToggle, 
  disabled
}: NamespaceRowProps) {
  const rowClass = `${styles.namespaceRow} ${
    namespace.isExternal ? styles.externalRow : 
    namespace.isWellKnown ? styles.wellKnownRow : ''
  }`;
  
  return (
    <div className={rowClass}>
      {selectable && (
        <Checkbox
          checked={selected}
          onChange={onToggle}
          disabled={disabled}
        />
      )}
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
