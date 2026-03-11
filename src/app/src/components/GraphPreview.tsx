/**
 * Graph Preview Component
 * 
 * Simple visual preview of the graph structure based on schema statistics.
 * Shows sample nodes and edges to give users an idea of the result.
 */

import {
  makeStyles,
  tokens,
  Body1,
  Body2,
  Title3,
  Badge,
} from '@fluentui/react-components';
import {
  Circle24Filled,
  ArrowRight24Regular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
  },
  statCard: {
    padding: '16px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    textAlign: 'center',
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 700,
    color: tokens.colorBrandForeground1,
  },
  statLabel: {
    color: tokens.colorNeutralForeground2,
    marginTop: '4px',
  },
  graphCanvas: {
    padding: '32px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    minHeight: '300px',
    position: 'relative',
    overflow: 'hidden',
  },
  nodesContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '24px',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeCluster: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  node: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    backgroundColor: tokens.colorBrandBackground2,
    border: `3px solid ${tokens.colorBrandStroke1}`,
    boxShadow: tokens.shadow4,
    textAlign: 'center',
    padding: '8px',
    transition: 'transform 0.2s, box-shadow 0.2s',
    '&:hover': {
      transform: 'scale(1.05)',
      boxShadow: tokens.shadow16,
    },
  },
  nodeLabel: {
    fontWeight: 600,
    fontSize: '12px',
    wordBreak: 'break-word',
  },
  nodeCount: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground2,
  },
  edgeContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '24px',
    padding: '16px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  edgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    fontSize: '13px',
  },
  edgeLabel: {
    fontWeight: 600,
    color: tokens.colorBrandForeground1,
    padding: '2px 8px',
    backgroundColor: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  legendSection: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  colorDot: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
  },
});

// Sample node types for the preview (NEN 2660 inspired)
const SAMPLE_NODES = [
  { type: 'Bridge', count: 5, color: '#0078d4' },
  { type: 'BridgeDeck', count: 5, color: '#107c10' },
  { type: 'Pillar', count: 12, color: '#008272' },
  { type: 'Road', count: 8, color: '#e81123' },
  { type: 'SteelGirder', count: 15, color: '#ff8c00' },
];

// Sample relationships
const SAMPLE_EDGES = [
  { from: 'Bridge', label: 'hasPart', to: 'BridgeDeck', count: 5 },
  { from: 'Bridge', label: 'hasPart', to: 'Pillar', count: 12 },
  { from: 'BridgeDeck', label: 'consistsOf', to: 'SteelGirder', count: 15 },
  { from: 'Road', label: 'crossesOver', to: 'Bridge', count: 3 },
];

interface GraphPreviewProps {
  schemaLevel: number | null;
}

export function GraphPreview({ schemaLevel }: GraphPreviewProps) {
  const styles = useStyles();

  // Adjust preview based on schema level (more confidence = more structure shown)
  const confidence = schemaLevel !== null ? Math.min(schemaLevel, 4) : 0;
  const nodeCount = 10 + confidence * 10;
  const edgeCount = 15 + confidence * 20;
  const typeCount = 3 + confidence * 2;

  return (
    <div className={styles.container}>
      <Title3>Graph Preview</Title3>
      <Body1>
        Based on your schema level ({schemaLevel ?? 'Not detected'}), here's a preview of the expected graph structure.
        {schemaLevel !== null && schemaLevel >= 2 && (
          <Badge appearance="filled" color="success" style={{ marginLeft: '8px' }}>
            High confidence
          </Badge>
        )}
      </Body1>

      {/* Statistics */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{typeCount}</div>
          <Body2 className={styles.statLabel}>Node Types</Body2>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{nodeCount}</div>
          <Body2 className={styles.statLabel}>Expected Nodes</Body2>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{edgeCount}</div>
          <Body2 className={styles.statLabel}>Expected Edges</Body2>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{SAMPLE_EDGES.length}</div>
          <Body2 className={styles.statLabel}>Relationship Types</Body2>
        </div>
      </div>

      {/* Visual Graph */}
      <div className={styles.graphCanvas}>
        <div className={styles.nodesContainer}>
          {SAMPLE_NODES.slice(0, typeCount).map((node) => (
            <div key={node.type} className={styles.nodeCluster}>
              <div 
                className={styles.node}
                style={{ borderColor: node.color, backgroundColor: `${node.color}20` }}
              >
                <Circle24Filled style={{ color: node.color, marginBottom: '4px' }} />
                <span className={styles.nodeLabel}>{node.type}</span>
              </div>
              <Body2 className={styles.nodeCount}>{node.count} instances</Body2>
            </div>
          ))}
        </div>
      </div>

      {/* Relationships */}
      <div className={styles.edgeContainer}>
        <Body2 style={{ fontWeight: 600, marginBottom: '8px' }}>Sample Relationships</Body2>
        {SAMPLE_EDGES.slice(0, typeCount).map((edge, i) => (
          <div key={i} className={styles.edgeRow}>
            <Badge appearance="outline">{edge.from}</Badge>
            <ArrowRight24Regular />
            <span className={styles.edgeLabel}>{edge.label}</span>
            <ArrowRight24Regular />
            <Badge appearance="outline">{edge.to}</Badge>
            <Body2 style={{ marginLeft: 'auto', color: tokens.colorNeutralForeground3 }}>
              ×{edge.count}
            </Body2>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div>
        <Body2 style={{ fontWeight: 600, marginBottom: '8px' }}>Node Types by Color</Body2>
        <div className={styles.legendSection}>
          {SAMPLE_NODES.slice(0, typeCount).map((node) => (
            <div key={node.type} className={styles.legendItem}>
              <div 
                className={styles.colorDot} 
                style={{ backgroundColor: node.color }}
              />
              <Body2>{node.type}</Body2>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
