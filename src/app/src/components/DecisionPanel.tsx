/**
 * Decision Panel Component
 * 
 * Displays and allows configuration of translation decisions (B-decisions).
 * Each decision determines how RDF constructs map to Fabric Graph.
 */

import { useState } from 'react';
import {
  makeStyles,
  tokens,
  Card,
  Title3,
  Body1,
  Body2,
  Button,
  Badge,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Radio,
  RadioGroup,
  Tooltip,
} from '@fluentui/react-components';
import {
  Checkmark24Regular,
  Lightbulb24Regular,
  Settings24Regular,
  Info16Regular,
} from '@fluentui/react-icons';

import { DecisionExample } from './DecisionExamples';

// Decision status based on schema level
export type DecisionStatus = 'auto' | 'hints' | 'manual';

// Option for a decision
export interface DecisionOption {
  value: string;
  label: string;
  description: string;
  isDefault?: boolean;
}

// Full decision definition
export interface DecisionDefinition {
  id: string;
  name: string;
  description: string;
  helpText: string;
  options: DecisionOption[];
  // Which schema levels auto-resolve this decision
  autoLevels: number[];
  // Which schema levels provide hints
  hintLevels: number[];
}

// All 12 B-decisions with their options
export const DECISION_DEFINITIONS: DecisionDefinition[] = [
  {
    id: 'B1',
    name: 'Node Type Strategy',
    description: 'How to derive node types from RDF classes',
    helpText: 'Determines how rdf:type declarations map to Fabric node types. With schema, classes become node types. Without schema, you choose the strategy.',
    autoLevels: [2, 3, 4],
    hintLevels: [],
    options: [
      { value: 'class', label: 'Use RDF Class', description: 'Each rdfs:Class/owl:Class becomes a node type', isDefault: true },
      { value: 'predicate', label: 'Infer from Predicates', description: 'Group nodes by common predicates' },
      { value: 'single', label: 'Single Type', description: 'All resources become one node type' },
      { value: 'uri-pattern', label: 'URI Pattern', description: 'Extract type from URI structure' },
    ],
  },
  {
    id: 'B2',
    name: 'Blank Node Handling',
    description: 'How to handle anonymous resources',
    helpText: 'RDF blank nodes have no persistent identifier. Choose how to generate IDs or inline them as nested properties.',
    autoLevels: [],
    hintLevels: [],
    options: [
      { value: 'generate', label: 'Generate IDs', description: 'Create stable UUIDs for blank nodes', isDefault: true },
      { value: 'inline', label: 'Inline as Properties', description: 'Collapse simple blank nodes into properties' },
      { value: 'skolemize', label: 'Skolemize', description: 'Replace with well-known URIs' },
      { value: 'skip', label: 'Skip', description: 'Exclude blank node structures' },
    ],
  },
  {
    id: 'B3',
    name: 'Multi-Type Resources',
    description: 'How to handle resources with multiple types',
    helpText: 'RDF allows resources to have multiple rdf:type values. Fabric nodes have a single type. Choose how to resolve.',
    autoLevels: [],
    hintLevels: [3, 4],
    options: [
      { value: 'primary', label: 'Most Specific', description: 'Use the most specific class in hierarchy', isDefault: true },
      { value: 'first', label: 'First Declared', description: 'Use the first type encountered' },
      { value: 'duplicate', label: 'Duplicate Nodes', description: 'Create a node for each type' },
      { value: 'merge', label: 'Merge Types', description: 'Combine type names (Type1_Type2)' },
    ],
  },
  {
    id: 'B4',
    name: 'Named Graph Strategy',
    description: 'How to preserve graph context',
    helpText: 'RDF datasets can contain named graphs. Choose how to represent this context in Fabric.',
    autoLevels: [],
    hintLevels: [],
    options: [
      { value: 'property', label: 'Graph Property', description: 'Add _graph property to nodes/edges', isDefault: true },
      { value: 'partition', label: 'Separate Graphs', description: 'Create separate Fabric graphs per named graph' },
      { value: 'ignore', label: 'Ignore', description: 'Merge all graphs, discard context' },
    ],
  },
  {
    id: 'B5',
    name: 'Language Tag Handling',
    description: 'How to handle multilingual literals',
    helpText: 'RDF literals can have language tags (e.g., "Hello"@en). Choose how to represent in Fabric.',
    autoLevels: [],
    hintLevels: [],
    options: [
      { value: 'suffix', label: 'Property Suffix', description: 'Create label_en, label_nl properties', isDefault: true },
      { value: 'preferred', label: 'Preferred Language', description: 'Keep only specified language' },
      { value: 'all', label: 'Array of Values', description: 'Store all translations in array' },
      { value: 'nested', label: 'Nested Object', description: 'Store as {en: "...", nl: "..."}' },
    ],
  },
  {
    id: 'B6',
    name: 'Edge Type Derivation',
    description: 'How to derive edge types from RDF properties',
    helpText: 'Object properties in RDF become edges in Fabric. With schema, property URIs become edge types.',
    autoLevels: [2, 3, 4],
    hintLevels: [],
    options: [
      { value: 'property', label: 'Use Property Name', description: 'Each object property becomes an edge type', isDefault: true },
      { value: 'domain-range', label: 'Domain-Range', description: 'Include source/target types in edge name' },
      { value: 'generic', label: 'Generic Relations', description: 'Use generic "relates_to" edge type' },
    ],
  },
  {
    id: 'B7',
    name: 'Datatype Coercion',
    description: 'How to map RDF datatypes to Fabric types',
    helpText: 'RDF has rich datatypes (xsd:integer, xsd:dateTime, etc.). Fabric supports string, number, boolean, datetime.',
    autoLevels: [4],
    hintLevels: [2, 3],
    options: [
      { value: 'strict', label: 'Strict Mapping', description: 'Map to closest Fabric type, validate values', isDefault: true },
      { value: 'string', label: 'All Strings', description: 'Store all values as strings' },
      { value: 'infer', label: 'Infer from Values', description: 'Detect type from actual data values' },
    ],
  },
  {
    id: 'B8',
    name: 'Property Attachment',
    description: 'Which properties attach to nodes vs edges',
    helpText: 'RDF allows properties on any resource. Fabric distinguishes node properties from edge properties.',
    autoLevels: [2, 3, 4],
    hintLevels: [],
    options: [
      { value: 'subject', label: 'Subject Node', description: 'Datatype properties go on the subject node', isDefault: true },
      { value: 'reified', label: 'Support Reification', description: 'If property references statement, attach to edge' },
      { value: 'both', label: 'Duplicate', description: 'Copy properties to both node and related edges' },
    ],
  },
  {
    id: 'B9',
    name: 'Edge vs Property',
    description: 'When to create edges vs nested properties',
    helpText: 'Some object properties point to simple lookup values that could be properties instead of separate nodes.',
    autoLevels: [3, 4],
    hintLevels: [2],
    options: [
      { value: 'all-edges', label: 'All as Edges', description: 'Every object property creates an edge', isDefault: true },
      { value: 'enum-property', label: 'Enums as Properties', description: 'Small enumerations become string properties' },
      { value: 'threshold', label: 'Instance Threshold', description: 'Types with few instances become properties' },
    ],
  },
  {
    id: 'B10',
    name: 'Inverse Properties',
    description: 'How to handle owl:inverseOf relationships',
    helpText: 'OWL can declare inverse properties (e.g., parent/child). Choose whether to materialize both directions.',
    autoLevels: [3, 4],
    hintLevels: [],
    options: [
      { value: 'materialize', label: 'Materialize Both', description: 'Create edges in both directions', isDefault: true },
      { value: 'single', label: 'Single Direction', description: 'Keep only one property, rely on queries' },
      { value: 'skip', label: 'Skip Inverse', description: 'Ignore inverse declarations' },
    ],
  },
  {
    id: 'B11',
    name: 'URI → ID Generation',
    description: 'How to generate Fabric node IDs from URIs',
    helpText: 'RDF uses URIs as identifiers. Fabric needs shorter string IDs. Choose the conversion strategy.',
    autoLevels: [],
    hintLevels: [1, 2, 3, 4],
    options: [
      { value: 'local-name', label: 'Local Name', description: 'Use the fragment/last segment of URI', isDefault: true },
      { value: 'label', label: 'Use rdfs:label', description: 'Use label if available, fallback to local name' },
      { value: 'hash', label: 'Hash URI', description: 'Generate short hash from full URI' },
      { value: 'full', label: 'Full URI', description: 'Store complete URI as ID' },
    ],
  },
  {
    id: 'B12',
    name: 'Hierarchy Strategy',
    description: 'How to handle class/property hierarchies',
    helpText: 'RDF schemas define hierarchies (rdfs:subClassOf, rdfs:subPropertyOf). Choose how to represent.',
    autoLevels: [1, 2, 3, 4],
    hintLevels: [],
    options: [
      { value: 'flatten', label: 'Flatten', description: 'Ignore hierarchy, use leaf classes only', isDefault: true },
      { value: 'preserve', label: 'Preserve', description: 'Create hierarchy edges between types' },
      { value: 'inherit', label: 'Inherit Properties', description: 'Copy parent properties to children' },
    ],
  },
];

// Get decision status based on schema level
export function getDecisionStatus(decision: DecisionDefinition, schemaLevel: number | null): DecisionStatus {
  const level = schemaLevel ?? 0;
  if (decision.autoLevels.includes(level)) return 'auto';
  if (decision.hintLevels.includes(level)) return 'hints';
  return 'manual';
}

// Get default value for a decision
export function getDefaultValue(decision: DecisionDefinition): string {
  const defaultOption = decision.options.find(o => o.isDefault);
  return defaultOption?.value || decision.options[0].value;
}

const useStyles = makeStyles({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  card: {
    padding: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    '&:hover': {
      boxShadow: tokens.shadow8,
      transform: 'translateY(-2px)',
    },
  },
  cardAuto: {
    borderLeft: `4px solid ${tokens.colorPaletteGreenBorder1}`,
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  cardHints: {
    borderLeft: `4px solid ${tokens.colorPaletteYellowBorder1}`,
    backgroundColor: tokens.colorPaletteYellowBackground1,
  },
  cardManual: {
    borderLeft: `4px solid ${tokens.colorNeutralStroke1}`,
  },
  cardConfigured: {
    borderLeft: `4px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
  },
  cardTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cardDescription: {
    color: tokens.colorNeutralForeground2,
    marginBottom: '12px',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  helpText: {
    backgroundColor: tokens.colorNeutralBackground3,
    padding: '12px',
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: '16px',
  },
  optionLabel: {
    fontWeight: 600,
  },
  optionDescription: {
    color: tokens.colorNeutralForeground2,
    fontSize: '12px',
    marginLeft: '28px',
  },
  statusLegend: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  legendDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
  },
});

interface DecisionPanelProps {
  schemaLevel: number | null;
  decisions: Record<string, string>;
  onDecisionChange: (decisionId: string, value: string) => void;
}

export function DecisionPanel({ schemaLevel, decisions, onDecisionChange }: DecisionPanelProps) {
  const styles = useStyles();
  const [selectedDecision, setSelectedDecision] = useState<DecisionDefinition | null>(null);
  const [pendingValue, setPendingValue] = useState<string>('');

  const handleCardClick = (decision: DecisionDefinition) => {
    setSelectedDecision(decision);
    setPendingValue(decisions[decision.id] || getDefaultValue(decision));
  };

  const handleSave = () => {
    if (selectedDecision) {
      onDecisionChange(selectedDecision.id, pendingValue);
      setSelectedDecision(null);
    }
  };

  const getStatusIcon = (status: DecisionStatus, isConfigured: boolean) => {
    if (isConfigured) return <Checkmark24Regular />;
    switch (status) {
      case 'auto': return <Checkmark24Regular />;
      case 'hints': return <Lightbulb24Regular />;
      default: return <Settings24Regular />;
    }
  };

  const getStatusBadge = (status: DecisionStatus, isConfigured: boolean) => {
    if (isConfigured) {
      return <Badge appearance="filled" color="brand">Configured</Badge>;
    }
    switch (status) {
      case 'auto': return <Badge appearance="filled" color="success">Auto</Badge>;
      case 'hints': return <Badge appearance="filled" color="warning">Hints</Badge>;
      default: return <Badge appearance="outline" color="informative">Manual</Badge>;
    }
  };

  const getCardStyle = (status: DecisionStatus, isConfigured: boolean) => {
    if (isConfigured) return `${styles.card} ${styles.cardConfigured}`;
    switch (status) {
      case 'auto': return `${styles.card} ${styles.cardAuto}`;
      case 'hints': return `${styles.card} ${styles.cardHints}`;
      default: return `${styles.card} ${styles.cardManual}`;
    }
  };

  const autoCount = DECISION_DEFINITIONS.filter(d => getDecisionStatus(d, schemaLevel) === 'auto').length;
  const configuredCount = Object.keys(decisions).length;
  const manualRequired = DECISION_DEFINITIONS.filter(d => 
    getDecisionStatus(d, schemaLevel) !== 'auto' && !decisions[d.id]
  ).length;

  return (
    <>
      <div className={styles.statusLegend}>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ backgroundColor: tokens.colorPaletteGreenBorder1 }} />
          <Body2>Auto-resolved ({autoCount})</Body2>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ backgroundColor: tokens.colorPaletteYellowBorder1 }} />
          <Body2>Has hints</Body2>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ backgroundColor: tokens.colorBrandStroke1 }} />
          <Body2>Configured ({configuredCount})</Body2>
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendDot} style={{ backgroundColor: tokens.colorNeutralStroke1 }} />
          <Body2>Manual ({manualRequired} remaining)</Body2>
        </div>
      </div>

      <div className={styles.grid}>
        {DECISION_DEFINITIONS.map((decision) => {
          const status = getDecisionStatus(decision, schemaLevel);
          const isConfigured = decision.id in decisions;
          const currentValue = decisions[decision.id] || getDefaultValue(decision);
          const currentOption = decision.options.find(o => o.value === currentValue);

          return (
            <Card
              key={decision.id}
              className={getCardStyle(status, isConfigured)}
              onClick={() => handleCardClick(decision)}
            >
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>
                  {getStatusIcon(status, isConfigured)}
                  <Body1 style={{ fontWeight: 600 }}>{decision.id}: {decision.name}</Body1>
                </div>
                <Tooltip content={decision.helpText} relationship="description">
                  <Info16Regular />
                </Tooltip>
              </div>
              <Body2 className={styles.cardDescription}>{decision.description}</Body2>
              <div className={styles.cardFooter}>
                <Body2 style={{ fontStyle: 'italic' }}>
                  {currentOption?.label || 'Not set'}
                </Body2>
                {getStatusBadge(status, isConfigured)}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Decision Configuration Dialog */}
      <Dialog open={!!selectedDecision} onOpenChange={(_, data) => !data.open && setSelectedDecision(null)}>
        <DialogSurface style={{ maxWidth: '800px', width: '90vw' }}>
          <DialogBody>
            <DialogTitle>
              {selectedDecision?.id}: {selectedDecision?.name}
            </DialogTitle>
            <DialogContent className={styles.dialogContent}>
              <div className={styles.helpText}>
                <Body2>{selectedDecision?.helpText}</Body2>
              </div>

              {selectedDecision && getDecisionStatus(selectedDecision, schemaLevel) === 'auto' && (
                <Body2 style={{ color: tokens.colorPaletteGreenForeground1 }}>
                  <Checkmark24Regular /> This decision is auto-resolved based on your schema (Level {schemaLevel}).
                  You can override if needed.
                </Body2>
              )}

              <Title3>Choose an option:</Title3>
              <RadioGroup
                value={pendingValue}
                onChange={(_, data) => setPendingValue(data.value)}
              >
                {selectedDecision?.options.map((option) => (
                  <div key={option.value} style={{ marginBottom: '12px' }}>
                    <Radio value={option.value} label={option.label} />
                    <Body2 className={styles.optionDescription}>{option.description}</Body2>
                  </div>
                ))}
              </RadioGroup>

              {selectedDecision && (
                <DecisionExample 
                  decisionId={selectedDecision.id} 
                  selectedOption={pendingValue}
                />
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setSelectedDecision(null)}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={handleSave}>
                Save Decision
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
