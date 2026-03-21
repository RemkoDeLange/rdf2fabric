/**
 * Scenario Preview Component
 * 
 * Dynamically computes and visualizes the expected graph output based on
 * all 12 B-decisions applied to a fictional NEN 2660-inspired RDF dataset.
 */

import {
  makeStyles,
  tokens,
  Card,
  Title3,
  Body1,
  Body2,
  Caption1,
  Badge,
  Divider,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  ProgressBar,
} from '@fluentui/react-components';
import {
  ArrowRight24Regular,
  Database24Regular,
  Organization24Regular,
  Link24Regular,
  Warning24Regular,
  Checkmark24Regular,
  LockClosed24Regular,
} from '@fluentui/react-icons';
import { DECISION_DEFINITIONS, getDecisionStatus, getDefaultValue } from './DecisionPanel';

// ============================================================================
// Dynamic Output Computation Engine
// ============================================================================

interface ComputedOutput {
  nodeTypes: number;
  nodes: number;
  edgeCount: number;
  properties: number;
  nodeTypesList: string[];
  sample: Array<{ type: string; id: string; props: string[] }>;
  sampleEdges: Array<{ from: string; label: string; to: string }>;
  preserved: string[];
  losses: string[];
}

// Base class hierarchy from input
const CLASS_HIERARCHY = {
  'SteelBridge': { parent: 'Bridge', instances: 1 },
  'Bridge': { parent: 'PhysicalObject', instances: 0 },
  'PhysicalObject': { parent: null, instances: 0 },
  'Infrastructure': { parent: null, instances: 0 },  // Multi-type on bridge1
  'BridgeDeck': { parent: 'Component', instances: 1 },
  'Pillar': { parent: 'Component', instances: 2 },
  'Component': { parent: null, instances: 0 },
  'Status': { parent: null, instances: 1 },  // enum-like
};

// Note: Input properties could be used for more detailed computation
// datatype: ['length', 'built', 'height', 'lat', 'lon']
// object: ['status', 'location', 'hasPart']
// langString: ['rdfs:label']
// hierarchy: ['rdfs:subClassOf', 'owl:inverseOf']
// inverse: ['isPartOf']

/**
 * Compute dynamic output based on actual decision values
 */
function computeOutput(decisions: Record<string, string>, inputStats: typeof INPUT_RDF.stats): ComputedOutput {
  const preserved: string[] = [];
  const losses: string[] = [];
  
  // ---- B1: Node Type Strategy ----
  let nodeTypesList: string[] = [];
  let useClassTypes = true;
  
  switch (decisions.B1) {
    case 'class':
      // Use actual RDF classes as node types
      nodeTypesList = Object.keys(CLASS_HIERARCHY).filter(c => 
        CLASS_HIERARCHY[c as keyof typeof CLASS_HIERARCHY].instances > 0 || c === 'Status'
      );
      preserved.push('✓ RDF classes preserved as distinct node types');
      break;
    case 'predicate':
      // Group by common predicates - fewer but meaningful types
      nodeTypesList = ['EntityWithLocation', 'PartEntity', 'LookupValue'];
      losses.push('Class semantics lost (grouped by predicate patterns)');
      useClassTypes = false;
      break;
    case 'single':
      // Everything becomes one type
      nodeTypesList = ['Resource'];
      losses.push('All type information lost (8 classes → 1 generic)');
      useClassTypes = false;
      break;
    case 'uri-pattern':
      // Extract from URI structure
      nodeTypesList = ['InfraObject', 'Component', 'Reference'];
      losses.push('Class hierarchy lost (types derived from URI patterns)');
      useClassTypes = false;
      break;
  }

  // ---- B2: Blank Node Handling ----
  let blankNodesAsNodes = 0;
  let blankNodeProps = 0;
  
  switch (decisions.B2) {
    case 'generate':
      blankNodesAsNodes = inputStats.blankNodes;
      if (useClassTypes) nodeTypesList.push('Location');
      preserved.push('✓ Blank nodes converted to queryable nodes with generated IDs');
      break;
    case 'inline':
      blankNodeProps = inputStats.blankNodes * 2;  // lat/lon inlined
      preserved.push('✓ Simple blank nodes inlined as nested properties');
      losses.push('Blank node identity lost (cannot link to inlined values)');
      break;
    case 'skolemize':
      blankNodesAsNodes = inputStats.blankNodes;
      if (useClassTypes) nodeTypesList.push('Location');
      preserved.push('✓ Blank nodes skolemized with well-known URIs');
      break;
    case 'skip':
      losses.push(`Blank node structures skipped entirely (${inputStats.blankNodes} blank nodes)`);
      break;
  }

  // ---- B3: Multi-Type Resources ----
  let nodeMultiplier = 1;
  
  switch (decisions.B3) {
    case 'primary':
      preserved.push('✓ Most specific class selected for multi-type resources');
      break;
    case 'first':
      losses.push('Type selection arbitrary (first encountered, not most specific)');
      break;
    case 'duplicate':
      nodeMultiplier = 1 + (inputStats.multiTypeResources * 0.5);  // ~4 multi-type → 2 extra nodes
      preserved.push('✓ All type memberships preserved via duplication');
      losses.push('Node duplication increases storage and query complexity');
      break;
    case 'merge':
      losses.push('Type names merged (e.g., "SteelBridge_Infrastructure")');
      break;
  }

  // ---- B4: Named Graph Strategy ----
  let graphProperty = false;
  
  switch (decisions.B4) {
    case 'property':
      graphProperty = true;
      preserved.push('✓ Named graph context preserved as _graph property');
      break;
    case 'partition':
      preserved.push('✓ Named graphs become separate Fabric graphs');
      break;
    case 'ignore':
      losses.push('Named graph context lost');
      break;
  }

  // ---- B5: Language Tag Handling ----
  let langProps = 0;
  
  switch (decisions.B5) {
    case 'suffix':
      langProps = inputStats.languages;  // label_en, label_nl, label_de
      preserved.push(`✓ All ${inputStats.languages} languages preserved as separate properties`);
      break;
    case 'preferred':
      langProps = 1;
      losses.push(`Language variants discarded (${inputStats.languages - 1} translations)`);
      break;
    case 'all':
      langProps = 1;  // array property
      preserved.push('✓ All language variants stored in array');
      losses.push('Language lookup requires array traversal');
      break;
    case 'nested':
      langProps = 1;  // nested object
      preserved.push('✓ Languages stored as nested object');
      break;
  }

  // ---- B6: Edge Type Derivation ----
  let edgeTypes: string[] = [];
  
  switch (decisions.B6) {
    case 'property':
      edgeTypes = ['hasPart', 'location', 'status'];
      preserved.push('✓ Edge types derived from RDF property names');
      break;
    case 'domain-range':
      edgeTypes = ['SteelBridge_hasPart_BridgeDeck', 'SteelBridge_hasPart_Pillar'];
      preserved.push('✓ Edge types include source/target context');
      losses.push('Edge type proliferation (more types to manage)');
      break;
    case 'generic':
      edgeTypes = ['relates_to'];
      losses.push('Relationship semantics lost (all become "relates_to")');
      break;
  }

  // ---- B7: Datatype Coercion ----
  switch (decisions.B7) {
    case 'strict':
      preserved.push('✓ RDF datatypes mapped to appropriate Fabric types');
      break;
    case 'string':
      losses.push('Data types lost (integers, dates → strings)');
      break;
    case 'infer':
      preserved.push('✓ Types inferred from actual values');
      losses.push('Type inference may be inconsistent across values');
      break;
  }

  // ---- B8: Property Attachment ----
  switch (decisions.B8) {
    case 'subject':
      preserved.push('✓ Datatype properties attached to subject nodes');
      break;
    case 'reified':
      preserved.push('✓ Reified statement properties attached to edges');
      break;
    case 'both':
      preserved.push('✓ Properties available on both nodes and edges');
      losses.push('Property duplication increases storage');
      break;
  }

  // ---- B9: Edge vs Property ----
  let enumsAsEdges = true;
  
  switch (decisions.B9) {
    case 'all-edges':
      enumsAsEdges = true;
      preserved.push('✓ All object properties create edges (full linkability)');
      break;
    case 'enum-property':
      enumsAsEdges = false;
      preserved.push('✓ Simple enums inlined as properties (simpler queries)');
      losses.push('Enum values not linkable as separate entities');
      break;
    case 'threshold':
      enumsAsEdges = false;
      preserved.push('✓ Small-cardinality types inlined as properties');
      break;
  }

  // ---- B10: Inverse Properties ----
  let inverseEdges = 0;
  
  switch (decisions.B10) {
    case 'materialize':
      inverseEdges = inputStats.inverseProperties * 3;  // 2 inverse props × instances
      preserved.push('✓ Inverse edges materialized (hasPart ↔ isPartOf)');
      break;
    case 'single':
      losses.push('Inverse edges not materialized (query patterns differ)');
      break;
    case 'skip':
      losses.push('Inverse property declarations ignored');
      break;
  }

  // ---- B11: URI → ID Generation ----
  let idStyle: 'readable' | 'hash' | 'full' = 'readable';
  
  switch (decisions.B11) {
    case 'local-name':
      idStyle = 'readable';
      preserved.push('✓ Human-readable IDs from URI local names');
      break;
    case 'label':
      idStyle = 'readable';
      preserved.push('✓ IDs from rdfs:label when available');
      break;
    case 'hash':
      idStyle = 'hash';
      preserved.push('✓ Compact hash-based IDs');
      losses.push('IDs not human-readable');
      break;
    case 'full':
      idStyle = 'full';
      preserved.push('✓ Full URI preserved as ID');
      losses.push('Long IDs impact storage and display');
      break;
  }

  // ---- B12: Hierarchy Strategy ----
  let hierarchyEdges = 0;
  
  switch (decisions.B12) {
    case 'flatten':
      losses.push('Class hierarchy flattened (parent classes lost)');
      break;
    case 'preserve':
      hierarchyEdges = inputStats.hierarchyDepth * 2;  // subClassOf edges
      preserved.push('✓ Class hierarchy preserved with subClassOf edges');
      break;
    case 'inherit':
      preserved.push('✓ Parent properties inherited by children');
      losses.push('Property duplication from inheritance');
      break;
  }

  // ---- Compute final statistics ----
  const uniqueNodeTypes = [...new Set(nodeTypesList)];
  
  // Base nodes: instances + enum instances (if edges) + blank nodes (if not skipped)
  let baseNodes = inputStats.instances;
  if (enumsAsEdges) baseNodes += 1;  // Status node
  baseNodes += blankNodesAsNodes;
  
  const totalNodes = Math.round(baseNodes * nodeMultiplier);
  
  // Base edges: object properties + inverse + hierarchy
  const baseEdges = 5;  // hasPart × 3, location, status
  const totalEdges = baseEdges + inverseEdges + hierarchyEdges - (enumsAsEdges ? 0 : 1);
  
  // Properties per node
  const propsPerInstance = 4;  // label, length/height, built, etc.
  const totalProperties = (propsPerInstance * inputStats.instances) + blankNodeProps + 
    (langProps > 1 ? langProps - 1 : 0) + (graphProperty ? totalNodes : 0);

  // ---- Generate sample nodes ----
  const sample = generateSampleNodes(decisions, idStyle, useClassTypes, enumsAsEdges, graphProperty, langProps);
  
  // ---- Generate sample edges ----
  const sampleEdges = generateSampleEdges(decisions, edgeTypes, enumsAsEdges, inverseEdges > 0, hierarchyEdges > 0);

  return {
    nodeTypes: uniqueNodeTypes.length,
    nodes: totalNodes,
    edgeCount: Math.max(1, totalEdges),
    properties: Math.max(8, totalProperties),
    nodeTypesList: uniqueNodeTypes,
    sample,
    sampleEdges,
    preserved,
    losses,
  };
}

/**
 * Generate sample nodes based on decision values
 */
function generateSampleNodes(
  decisions: Record<string, string>,
  idStyle: 'readable' | 'hash' | 'full',
  useClassTypes: boolean,
  enumsAsEdges: boolean,
  graphProperty: boolean,
  langProps: number
): ComputedOutput['sample'] {
  const sample: ComputedOutput['sample'] = [];
  
  // Node ID based on B11
  const bridgeId = idStyle === 'hash' ? 'a1b2c3d4' : 
                   idStyle === 'full' ? 'http://example.org/infra/bridge1' : 'bridge1';
  const deckId = idStyle === 'hash' ? 'e5f6g7h8' :
                 idStyle === 'full' ? 'http://example.org/infra/deck1' : 'deck1';
  
  // Main bridge node
  const bridgeType = useClassTypes ? 'SteelBridge' : 
                     decisions.B1 === 'predicate' ? 'EntityWithLocation' : 'Resource';
  
  const bridgeProps: string[] = [];
  
  // Language handling (B5)
  if (langProps > 1) {
    bridgeProps.push('label_nl: "IJsselbrug"', 'label_en: "IJssel Bridge"');
  } else {
    bridgeProps.push('label: "IJsselbrug"');
  }
  
  // Datatype values (B7)
  if (decisions.B7 === 'string') {
    bridgeProps.push('length: "250"', 'built: "1936-01-15"');
  } else {
    bridgeProps.push('length: 250', 'built: 1936-01-15');
  }
  
  // Enum as property (B9)
  if (!enumsAsEdges) {
    bridgeProps.push('status: "Active"');
  }
  
  // Blank node inline (B2)
  if (decisions.B2 === 'inline') {
    bridgeProps.push('location_lat: "52.12"', 'location_lon: "6.09"');
  }
  
  // Graph property (B4)
  if (graphProperty) {
    bridgeProps.push('_graph: "default"');
  }
  
  sample.push({ type: bridgeType, id: bridgeId, props: bridgeProps });
  
  // Deck node
  const deckType = useClassTypes ? 'BridgeDeck' : 
                   decisions.B1 === 'predicate' ? 'PartEntity' : 'Resource';
  const deckProps = langProps > 1 ? ['label_nl: "Hoofddek"'] : ['label: "Hoofddek"'];
  if (graphProperty) deckProps.push('_graph: "default"');
  
  sample.push({ type: deckType, id: deckId, props: deckProps });
  
  // Location node (B2 = generate or skolemize)
  if (decisions.B2 === 'generate' || decisions.B2 === 'skolemize') {
    const locType = useClassTypes ? 'Location' : 
                    decisions.B1 === 'predicate' ? 'LookupValue' : 'Resource';
    const locId = decisions.B2 === 'skolemize' ? '.well-known/genid/loc1' :
                  idStyle === 'hash' ? 'i9j0k1l2' : 'loc_a1b2';
    sample.push({
      type: locType,
      id: locId,
      props: ['lat: "52.12"', 'lon: "6.09"'],
    });
  }
  
  // Status node (B9 = all-edges)
  if (enumsAsEdges) {
    const statusType = useClassTypes ? 'Status' : 
                       decisions.B1 === 'predicate' ? 'LookupValue' : 'Resource';
    sample.push({
      type: statusType,
      id: idStyle === 'hash' ? 'm3n4o5p6' : 'Active',
      props: ['uri: "http://example.org/infra/Active"'],
    });
  }
  
  return sample;
}

/**
 * Generate sample edges based on decision values
 */
function generateSampleEdges(
  decisions: Record<string, string>,
  _edgeTypes: string[],  // Available for future use
  enumsAsEdges: boolean,
  hasInverse: boolean,
  hasHierarchy: boolean
): ComputedOutput['sampleEdges'] {
  const edges: ComputedOutput['sampleEdges'] = [];
  
  const bridgeType = decisions.B1 === 'class' ? 'SteelBridge' : 
                     decisions.B1 === 'predicate' ? 'EntityWithLocation' : 'Resource';
  const deckType = decisions.B1 === 'class' ? 'BridgeDeck' :
                   decisions.B1 === 'predicate' ? 'PartEntity' : 'Resource';
  const pillarType = decisions.B1 === 'class' ? 'Pillar' :
                     decisions.B1 === 'predicate' ? 'PartEntity' : 'Resource';
  
  // hasPart edge
  const partLabel = decisions.B6 === 'generic' ? 'relates_to' :
                    decisions.B6 === 'domain-range' ? `${bridgeType}_hasPart_${deckType}` : 'hasPart';
  
  edges.push({ from: bridgeType, label: partLabel, to: deckType });
  edges.push({ from: bridgeType, label: partLabel.replace(deckType, pillarType), to: pillarType });
  
  // Inverse edge (B10)
  if (hasInverse) {
    const inverseLabel = decisions.B6 === 'generic' ? 'relates_to' : 'isPartOf';
    edges.push({ from: deckType, label: inverseLabel, to: bridgeType });
  }
  
  // Location edge (B2 != inline && B2 != skip)
  if (decisions.B2 === 'generate' || decisions.B2 === 'skolemize') {
    const locType = decisions.B1 === 'class' ? 'Location' :
                    decisions.B1 === 'predicate' ? 'LookupValue' : 'Resource';
    const locLabel = decisions.B6 === 'generic' ? 'relates_to' : 'location';
    edges.push({ from: bridgeType, label: locLabel, to: locType });
  }
  
  // Status edge (B9 = all-edges)
  if (enumsAsEdges) {
    const statusType = decisions.B1 === 'class' ? 'Status' :
                       decisions.B1 === 'predicate' ? 'LookupValue' : 'Resource';
    const statusLabel = decisions.B6 === 'generic' ? 'relates_to' : 'status';
    edges.push({ from: bridgeType, label: statusLabel, to: statusType });
  }
  
  // Hierarchy edge (B12 = preserve)
  if (hasHierarchy && decisions.B1 === 'class') {
    edges.push({ from: 'SteelBridge', label: 'subClassOf', to: 'Bridge' });
  }
  
  return edges;
}

// ============================================================================
// Styles
// ============================================================================

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  splitView: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: '24px',
    alignItems: 'start',
  },
  arrow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 16px',
    color: tokens.colorBrandForeground1,
  },
  section: {
    padding: '16px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  statItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusSmall,
  },
  statLabel: {
    color: tokens.colorNeutralForeground2,
  },
  statValue: {
    fontWeight: 600,
    fontFamily: 'monospace',
  },
  statChanged: {
    color: tokens.colorPaletteRedForeground1,
  },
  statSame: {
    color: tokens.colorPaletteGreenForeground1,
  },
  rdfSnippet: {
    fontFamily: 'monospace',
    fontSize: '12px',
    backgroundColor: tokens.colorNeutralBackground1,
    padding: '12px',
    borderRadius: tokens.borderRadiusSmall,
    whiteSpace: 'pre-wrap',
    maxHeight: '200px',
    overflow: 'auto',
  },
  graphVisualization: {
    padding: '16px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusSmall,
    minHeight: '150px',
  },
  nodeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  node: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 12px',
    borderRadius: '16px',
    fontSize: '13px',
    fontWeight: 500,
  },
  nodeBridge: {
    backgroundColor: '#0078d420',
    border: '2px solid #0078d4',
    color: '#0078d4',
  },
  nodeDeck: {
    backgroundColor: '#107c1020',
    border: '2px solid #107c10',
    color: '#107c10',
  },
  nodePillar: {
    backgroundColor: '#00827220',
    border: '2px solid #008272',
    color: '#008272',
  },
  nodeLocation: {
    backgroundColor: '#ff8c0020',
    border: '2px solid #ff8c00',
    color: '#ff8c00',
  },
  nodeGeneric: {
    backgroundColor: tokens.colorNeutralBackground4,
    border: `2px solid ${tokens.colorNeutralStroke1}`,
  },
  edgeLabel: {
    padding: '2px 8px',
    backgroundColor: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusSmall,
    fontSize: '12px',
    fontWeight: 600,
  },
  decisionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  decisionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    padding: '4px 0',
  },
  decisionId: {
    fontWeight: 600,
    color: tokens.colorNeutralForeground2,
  },
  lossIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: tokens.colorPaletteYellowBackground1,
    borderRadius: tokens.borderRadiusSmall,
    marginTop: '8px',
  },
  gainIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: tokens.colorPaletteGreenBackground1,
    borderRadius: tokens.borderRadiusSmall,
    marginTop: '8px',
  },
  lockedContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
    textAlign: 'center',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  lockedIcon: {
    fontSize: '48px',
    color: tokens.colorNeutralForeground3,
    marginBottom: '16px',
  },
  progressSection: {
    width: '100%',
    maxWidth: '400px',
    marginTop: '24px',
  },
});

// ============================================================================
// Input Dataset (NEN 2660-inspired)
// ============================================================================

// Fictional RDF input dataset statistics (NEN 2660-inspired)
const INPUT_RDF = {
  stats: {
    triples: 156,
    classes: 8,
    properties: 12,
    instances: 25,
    blankNodes: 7,
    namedGraphs: 2,
    languages: 3,
    datatypes: 5,
    multiTypeResources: 4,
    inverseProperties: 2,
    hierarchyDepth: 3,
  },
  snippet: `@prefix : <http://example.org/infra/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix nen: <http://nen2660.nl/def#> .

# Classes with hierarchy
:SteelBridge rdfs:subClassOf :Bridge .
:Bridge rdfs:subClassOf :PhysicalObject .
:BridgeDeck rdfs:subClassOf :Component .
:Pillar rdfs:subClassOf :Component .

# Instances
:bridge1 a :SteelBridge, :Infrastructure ;
  rdfs:label "IJsselbrug"@nl, "IJssel Bridge"@en ;
  :length "250"^^xsd:integer ;
  :built "1936-01-15"^^xsd:date ;
  :status :Active ;
  :location [ :lat "52.12" ; :lon "6.09" ] .  # blank node

:bridge1 :hasPart :deck1, :pillar1, :pillar2 .
:deck1 a :BridgeDeck ;
  rdfs:label "Hoofddek"@nl .
:pillar1 a :Pillar ;
  :height "15"^^xsd:integer .

# Inverse property
:isPartOf owl:inverseOf :hasPart .`,
  classes: ['SteelBridge', 'Bridge', 'PhysicalObject', 'Infrastructure', 'BridgeDeck', 'Pillar', 'Component', 'Status'],
  properties: ['rdfs:label', 'length', 'built', 'status', 'location', 'lat', 'lon', 'hasPart', 'isPartOf', 'height', 'rdfs:subClassOf', 'owl:inverseOf'],
};

// All 12 decision IDs
const ALL_DECISIONS = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12'];

// ============================================================================
// Component
// ============================================================================

interface ScenarioPreviewProps {
  decisions: Record<string, string>;
  schemaLevel: number | null;
}

export function ScenarioPreview({ decisions, schemaLevel }: ScenarioPreviewProps) {
  const styles = useStyles();

  // Build effective decisions: explicit + auto-resolved defaults
  const effectiveDecisions: Record<string, string> = {};
  const autoResolvedIds: string[] = [];
  const manuallySetIds: string[] = [];
  const missingIds: string[] = [];

  ALL_DECISIONS.forEach(id => {
    const definition = DECISION_DEFINITIONS.find(d => d.id === id);
    if (!definition) return;

    if (decisions[id]) {
      // Explicitly set by user
      effectiveDecisions[id] = decisions[id];
      manuallySetIds.push(id);
    } else {
      const status = getDecisionStatus(definition, schemaLevel);
      if (status === 'auto') {
        // Auto-resolved - use default value
        effectiveDecisions[id] = getDefaultValue(definition);
        autoResolvedIds.push(id);
      } else {
        // Not set and not auto-resolved
        missingIds.push(id);
      }
    }
  });

  const progress = (manuallySetIds.length + autoResolvedIds.length) / ALL_DECISIONS.length;
  const allSet = missingIds.length === 0;

  // Show locked state if not all decisions are set
  if (!allSet) {
    return (
      <div className={styles.container}>
        <div className={styles.lockedContainer}>
          <LockClosed24Regular className={styles.lockedIcon} />
          <Title3>Preview Locked</Title3>
          <Body1 style={{ marginTop: '8px', color: tokens.colorNeutralForeground2 }}>
            Set all 12 translation decisions to unlock the preview.
          </Body1>
          
          <div className={styles.progressSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <Body2>Progress</Body2>
              <Body2 style={{ fontWeight: 600 }}>
                {manuallySetIds.length + autoResolvedIds.length} / 12 decisions
                {autoResolvedIds.length > 0 && (
                  <Caption1 style={{ marginLeft: '8px', color: tokens.colorPaletteGreenForeground1 }}>
                    ({autoResolvedIds.length} auto-resolved)
                  </Caption1>
                )}
              </Body2>
            </div>
            <ProgressBar value={progress} />
            
            <div style={{ marginTop: '16px', textAlign: 'left' }}>
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Missing decisions (need manual input):</Caption1>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {missingIds.map(id => (
                  <Badge key={id} appearance="outline" color="danger">{id}</Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Compute dynamic output based on actual decision values
  const computed = computeOutput(effectiveDecisions, INPUT_RDF.stats);

  const getNodeStyle = (type: string) => {
    if (type.includes('Bridge')) return styles.nodeBridge;
    if (type.includes('Deck')) return styles.nodeDeck;
    if (type.includes('Pillar') || type.includes('Part')) return styles.nodePillar;
    if (type.includes('Location') || type.includes('Lookup')) return styles.nodeLocation;
    return styles.nodeGeneric;
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div style={{ marginBottom: '8px' }}>
        <Title3 style={{ marginBottom: '8px', display: 'block' }}>Translation Preview</Title3>
        <Body1 style={{ color: tokens.colorNeutralForeground2 }}>
          Preview showing how your {manuallySetIds.length + autoResolvedIds.length} decisions
          {autoResolvedIds.length > 0 && (
            <Caption1 style={{ marginLeft: '8px', color: tokens.colorPaletteGreenForeground1 }}>
              ({autoResolvedIds.length} auto-resolved)
            </Caption1>
          )}
          {' '}would transform a <strong>sample NEN 2660 infrastructure dataset</strong> into a Fabric Graph.
        </Body1>
      </div>

      {/* Split view: Input → Output */}
      <div className={styles.splitView}>
        {/* Input RDF */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <Database24Regular />
            <Body1 style={{ fontWeight: 600 }}>Input RDF</Body1>
          </div>
          
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Triples</span>
              <span className={styles.statValue}>{INPUT_RDF.stats.triples}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Classes</span>
              <span className={styles.statValue}>{INPUT_RDF.stats.classes}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Properties</span>
              <span className={styles.statValue}>{INPUT_RDF.stats.properties}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Instances</span>
              <span className={styles.statValue}>{INPUT_RDF.stats.instances}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Blank Nodes</span>
              <span className={styles.statValue}>{INPUT_RDF.stats.blankNodes}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Languages</span>
              <span className={styles.statValue}>{INPUT_RDF.stats.languages}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Named Graphs</span>
              <span className={styles.statValue}>{INPUT_RDF.stats.namedGraphs}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Multi-type Resources</span>
              <span className={styles.statValue}>{INPUT_RDF.stats.multiTypeResources}</span>
            </div>
          </div>

          <Accordion collapsible style={{ marginTop: '12px' }}>
            <AccordionItem value="rdf">
              <AccordionHeader>View RDF Snippet</AccordionHeader>
              <AccordionPanel>
                <div className={styles.rdfSnippet}>{INPUT_RDF.snippet}</div>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Arrow */}
        <div className={styles.arrow}>
          <ArrowRight24Regular style={{ fontSize: '32px' }} />
          <Caption1 style={{ marginTop: '8px' }}>12 decisions</Caption1>
        </div>

        {/* Output Graph */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <Organization24Regular />
            <Body1 style={{ fontWeight: 600 }}>Output Graph</Body1>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Node Types</span>
              <span className={`${styles.statValue} ${computed.nodeTypes < INPUT_RDF.stats.classes ? styles.statChanged : styles.statSame}`}>
                {computed.nodeTypes}
                {computed.nodeTypes < INPUT_RDF.stats.classes && (
                  <Caption1 style={{ marginLeft: '4px' }}>(-{INPUT_RDF.stats.classes - computed.nodeTypes})</Caption1>
                )}
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Nodes</span>
              <span className={styles.statValue}>{computed.nodes}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Edges</span>
              <span className={styles.statValue}>{computed.edgeCount}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Properties</span>
              <span className={styles.statValue}>{computed.properties}</span>
            </div>
          </div>

          <div style={{ marginTop: '12px' }}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>Node types:</Caption1>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              {computed.nodeTypesList.map((type) => (
                <span key={type} className={`${styles.node} ${getNodeStyle(type)}`}>
                  {type}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sample Output Visualization */}
      <Card>
        <div className={styles.sectionTitle}>
          <Organization24Regular />
          <Body1 style={{ fontWeight: 600 }}>Sample Nodes</Body1>
        </div>

        {computed.sample.map((node, i) => (
          <div key={i} className={styles.nodeRow}>
            <span className={`${styles.node} ${getNodeStyle(node.type)}`}>
              {node.type}
            </span>
            <Body2 style={{ fontFamily: 'monospace' }}>id: "{node.id}"</Body2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {node.props.map((prop, j) => (
                <Badge key={j} appearance="outline" size="small">{prop}</Badge>
              ))}
            </div>
          </div>
        ))}

        <Divider style={{ margin: '16px 0' }} />

        <div className={styles.sectionTitle}>
          <Link24Regular />
          <Body1 style={{ fontWeight: 600 }}>Sample Edges</Body1>
        </div>

        {computed.sampleEdges.map((edge, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
            <span className={`${styles.node} ${getNodeStyle(edge.from)}`}>{edge.from}</span>
            <span>→</span>
            <span className={styles.edgeLabel}>{edge.label}</span>
            <span>→</span>
            <span className={`${styles.node} ${getNodeStyle(edge.to)}`}>{edge.to}</span>
          </div>
        ))}
      </Card>

      {/* Effects Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <Checkmark24Regular style={{ color: tokens.colorPaletteGreenForeground1 }} />
            <Body1 style={{ fontWeight: 600 }}>Preserved</Body1>
          </div>
          {computed.preserved.map((note, i) => (
            <div key={i} className={styles.gainIndicator}>
              <Body2>{note}</Body2>
            </div>
          ))}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <Warning24Regular style={{ color: tokens.colorPaletteYellowForeground1 }} />
            <Body1 style={{ fontWeight: 600 }}>Information Loss</Body1>
          </div>
          {computed.losses.length === 0 ? (
            <div className={styles.gainIndicator}>
              <Body2>✓ No significant information loss</Body2>
            </div>
          ) : (
            computed.losses.map((loss, i) => (
              <div key={i} className={styles.lossIndicator}>
                <Body2>⚠ {loss}</Body2>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Decision Summary */}
      <Accordion collapsible>
        <AccordionItem value="decisions">
          <AccordionHeader>View All 12 Decision Settings</AccordionHeader>
          <AccordionPanel>
            <div className={styles.decisionList}>
              {Object.entries(effectiveDecisions).map(([id, value]) => (
                <div key={id} className={styles.decisionItem}>
                  <span className={styles.decisionId}>{id}</span>
                  <Badge appearance="filled" color="brand">{value}</Badge>
                </div>
              ))}
            </div>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
