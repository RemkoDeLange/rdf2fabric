/**
 * NamespacePanel Component
 * 
 * Displays detected namespaces from RDF files with classification
 * (external, well-known, etc.) and allows selecting which to fetch.
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
  ProgressBar,
} from '@fluentui/react-components';
import {
  Globe24Regular,
  Library24Regular,
  Link24Regular,
  ArrowDownload24Regular,
  Info16Regular,
  ArrowSync24Regular,
  CheckmarkCircle16Regular,
  ErrorCircle16Regular,
} from '@fluentui/react-icons';
import type { DetectedNamespace } from '../services/namespaceDetector';
import { getNamespaceStats } from '../services/namespaceDetector';
import type { FetchProgress, FetchResult } from '../services/ontologyFetcher';

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
  progressContainer: {
    marginTop: '8px',
  },
  progressLabel: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
    marginBottom: '4px',
  },
  fetchResults: {
    marginTop: '8px',
    fontSize: '12px',
    display: 'flex',
    gap: '16px',
  },
  successCount: {
    color: tokens.colorPaletteGreenForeground1,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  failCount: {
    color: tokens.colorPaletteRedForeground1,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  statusIcon: {
    marginLeft: 'auto',
  },
  badge: {
    fontSize: '11px',
  },
});

interface NamespacePanelProps {
  namespaces: DetectedNamespace[] | undefined;
  isLoading?: boolean;
  onRefresh?: () => void;
  onFetchOntologies?: (uris: string[], onProgress: (progress: FetchProgress[]) => void) => Promise<FetchResult[]>;
}

export function NamespacePanel({ namespaces, isLoading, onRefresh, onFetchOntologies }: NamespacePanelProps) {
  const styles = useStyles();
  const [selectedUris, setSelectedUris] = useState<Set<string>>(new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<FetchProgress[]>([]);
  const [fetchResults, setFetchResults] = useState<FetchResult[] | null>(null);
  
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
  
  // Handle fetch button click
  const handleFetch = async () => {
    if (!onFetchOntologies || selectedUris.size === 0) return;
    
    setIsFetching(true);
    setFetchResults(null);
    setFetchProgress([]);
    
    try {
      const results = await onFetchOntologies(
        Array.from(selectedUris),
        (progress) => setFetchProgress([...progress])
      );
      setFetchResults(results);
      // Clear selection for successful fetches
      const successfulUris = new Set(results.filter(r => r.success).map(r => r.uri));
      setSelectedUris(prev => new Set([...prev].filter(uri => !successfulUris.has(uri))));
    } finally {
      setIsFetching(false);
    }
  };
  
  // Get fetch status for a specific URI
  const getFetchStatus = (uri: string): FetchProgress | undefined => {
    return fetchProgress.find(p => p.uri === uri);
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
  
  // Calculate fetch progress
  const completedCount = fetchProgress.filter(p => p.status === 'success' || p.status === 'failed').length;
  const totalToFetch = fetchProgress.length;
  const progressValue = totalToFetch > 0 ? completedCount / totalToFetch : 0;
  const currentlyFetching = fetchProgress.find(p => p.status === 'fetching');
  
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
              disabled={isFetching}
            />
          )}
        </div>
      </div>
      
      <div className={styles.list}>
        {/* External namespaces first - these are fetchable */}
        {externalNamespaces.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
              {onFetchOntologies && (
                <Checkbox
                  checked={selectedUris.size === externalNamespaces.length ? true : selectedUris.size > 0 ? 'mixed' : false}
                  onChange={toggleSelectAll}
                  disabled={isFetching}
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
                selectable={!!onFetchOntologies}
                selected={selectedUris.has(ns.uri)}
                onToggle={() => toggleSelection(ns.uri)}
                disabled={isFetching}
                fetchStatus={getFetchStatus(ns.uri)}
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
      
      {/* Fetch section */}
      {externalNamespaces.length > 0 && onFetchOntologies && (
        <div className={styles.fetchSection}>
          <div className={styles.fetchControls}>
            <Button
              appearance="outline"
              icon={isFetching ? <Spinner size="tiny" /> : <ArrowDownload24Regular />}
              onClick={handleFetch}
              disabled={isFetching || selectedUris.size === 0}
            >
              {isFetching 
                ? `Fetching (${completedCount}/${totalToFetch})...` 
                : `Fetch Selected (${selectedUris.size})`}
            </Button>
          </div>
          
          {/* Progress bar during fetch */}
          {isFetching && totalToFetch > 0 && (
            <div className={styles.progressContainer}>
              <div className={styles.progressLabel}>
                {currentlyFetching 
                  ? `Fetching: ${currentlyFetching.uri.slice(0, 50)}...`
                  : 'Completing...'}
              </div>
              <ProgressBar value={progressValue} />
            </div>
          )}
          
          {/* Results summary */}
          {fetchResults && !isFetching && (
            <div className={styles.fetchResults}>
              <span className={styles.successCount}>
                <CheckmarkCircle16Regular />
                {fetchResults.filter(r => r.success).length} fetched
              </span>
              {fetchResults.some(r => !r.success) && (
                <span className={styles.failCount}>
                  <ErrorCircle16Regular />
                  {fetchResults.filter(r => !r.success).length} failed
                </span>
              )}
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
  fetchStatus?: FetchProgress;
}

function NamespaceRow({ 
  namespace, 
  styles, 
  selectable, 
  selected, 
  onToggle, 
  disabled,
  fetchStatus 
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
      {/* Fetch status indicator */}
      {fetchStatus && (
        <span className={styles.statusIcon}>
          {fetchStatus.status === 'fetching' && <Spinner size="tiny" />}
          {fetchStatus.status === 'success' && (
            <CheckmarkCircle16Regular style={{ color: tokens.colorPaletteGreenForeground1 }} />
          )}
          {fetchStatus.status === 'failed' && (
            <Tooltip content={fetchStatus.error || 'Failed'} relationship="label">
              <ErrorCircle16Regular style={{ color: tokens.colorPaletteRedForeground1 }} />
            </Tooltip>
          )}
        </span>
      )}
    </div>
  );
}
