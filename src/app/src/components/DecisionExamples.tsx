/**
 * Decision Examples Component
 * 
 * Visual examples showing how each decision transforms RDF to LPG.
 */

import { makeStyles, tokens, Body2 } from '@fluentui/react-components';

const useStyles = makeStyles({
  container: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  title: {
    fontWeight: 600,
    marginBottom: '12px',
  },
  exampleRow: {
    display: 'flex',
    gap: '24px',
    marginBottom: '16px',
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: tokens.colorNeutralForeground3,
    marginBottom: '4px',
    textTransform: 'uppercase',
  },
  codeBlock: {
    fontFamily: 'Consolas, Monaco, monospace',
    fontSize: '12px',
    backgroundColor: tokens.colorNeutralBackground3,
    padding: '12px',
    borderRadius: tokens.borderRadiusMedium,
    whiteSpace: 'pre-wrap',
    lineHeight: 1.5,
  },
  arrow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: tokens.colorBrandForeground1,
    padding: '0 8px',
  },
  node: {
    display: 'inline-block',
    padding: '8px 16px',
    backgroundColor: tokens.colorBrandBackground2,
    borderRadius: '20px',
    border: `2px solid ${tokens.colorBrandStroke1}`,
    fontWeight: 600,
    fontSize: '13px',
    marginRight: '8px',
    marginBottom: '8px',
  },
  edge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 12px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    fontSize: '12px',
  },
  edgeLabel: {
    fontWeight: 600,
    color: tokens.colorBrandForeground1,
  },
  property: {
    color: tokens.colorNeutralForeground2,
    fontSize: '11px',
    marginLeft: '4px',
  },
  graphPreview: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    flexWrap: 'wrap',
  },
});

// Visual node component
function VisualNode({ label, properties }: { label: string; properties?: string[] }) {
  const styles = useStyles();
  return (
    <div className={styles.node}>
      {label}
      {properties && properties.map((p, i) => (
        <span key={i} className={styles.property}>{p}</span>
      ))}
    </div>
  );
}

// Visual edge component
function VisualEdge({ from, label, to }: { from: string; label: string; to: string }) {
  const styles = useStyles();
  return (
    <div className={styles.edge}>
      <span>{from}</span>
      <span>→</span>
      <span className={styles.edgeLabel}>{label}</span>
      <span>→</span>
      <span>{to}</span>
    </div>
  );
}

// Examples for each decision
const DECISION_EXAMPLES: Record<string, {
  input: string;
  outputs: Record<string, { description: string; visual: JSX.Element }>;
}> = {
  B1: {
    input: `:bridge1 a :SteelBridge .\n:bridge1 :name "IJsselbrug" .`,
    outputs: {
      'class': {
        description: 'Creates node type from rdf:type',
        visual: (
          <>
            <VisualNode label="SteelBridge" properties={['name: "IJsselbrug"']} />
          </>
        ),
      },
      'predicate': {
        description: 'Infers type from predicates used',
        visual: (
          <>
            <VisualNode label="NamedThing" properties={['name: "IJsselbrug"']} />
          </>
        ),
      },
      'single': {
        description: 'All become generic Resource type',
        visual: (
          <>
            <VisualNode label="Resource" properties={['name: "IJsselbrug"']} />
          </>
        ),
      },
      'uri-pattern': {
        description: 'Extract type from URI pattern',
        visual: (
          <>
            <VisualNode label="bridge" properties={['name: "IJsselbrug"']} />
          </>
        ),
      },
    },
  },
  B2: {
    input: `:person1 :address [\n  :street "Main St" ;\n  :city "Amsterdam"\n] .`,
    outputs: {
      'generate': {
        description: 'Blank node becomes separate node with generated ID',
        visual: (
          <>
            <VisualNode label="Person" />
            <span style={{ margin: '0 8px' }}>→ address →</span>
            <VisualNode label="Address" properties={['id: "addr_a1b2"', 'street: "Main St"']} />
          </>
        ),
      },
      'inline': {
        description: 'Blank node properties inlined on parent',
        visual: (
          <>
            <VisualNode label="Person" properties={['address_street: "Main St"', 'address_city: "Amsterdam"']} />
          </>
        ),
      },
      'skolemize': {
        description: 'Blank node gets well-known URI',
        visual: (
          <>
            <VisualNode label="Person" />
            <span style={{ margin: '0 8px' }}>→ address →</span>
            <VisualNode label="Address" properties={['uri: "urn:blank:1"']} />
          </>
        ),
      },
      'skip': {
        description: 'Blank node structure is excluded',
        visual: (
          <>
            <VisualNode label="Person" properties={['(no address)']} />
          </>
        ),
      },
    },
  },
  B3: {
    input: `:item1 a :Bridge, :Infrastructure,\n       :PhysicalObject .`,
    outputs: {
      'primary': {
        description: 'Uses most specific class from hierarchy',
        visual: (
          <>
            <VisualNode label="Bridge" />
          </>
        ),
      },
      'first': {
        description: 'Uses first type declared',
        visual: (
          <>
            <VisualNode label="Bridge" />
          </>
        ),
      },
      'duplicate': {
        description: 'Creates node copy for each type',
        visual: (
          <>
            <VisualNode label="Bridge" />
            <VisualNode label="Infrastructure" />
            <VisualNode label="PhysicalObject" />
          </>
        ),
      },
      'merge': {
        description: 'Combines all types into one label',
        visual: (
          <>
            <VisualNode label="Bridge_Infrastructure_PhysicalObject" />
          </>
        ),
      },
    },
  },
  B4: {
    input: `GRAPH :g1 {\n  :bridge1 :name "A" .\n}\nGRAPH :g2 {\n  :bridge2 :name "B" .\n}`,
    outputs: {
      'property': {
        description: 'Graph URI stored as property',
        visual: (
          <>
            <VisualNode label="Bridge" properties={['_graph: "g1"']} />
            <VisualNode label="Bridge" properties={['_graph: "g2"']} />
          </>
        ),
      },
      'partition': {
        description: 'Separate Fabric graphs per named graph',
        visual: (
          <Body2>Graph "g1" and Graph "g2" (separate)</Body2>
        ),
      },
      'ignore': {
        description: 'All merged, graph context lost',
        visual: (
          <>
            <VisualNode label="Bridge" properties={['name: "A"']} />
            <VisualNode label="Bridge" properties={['name: "B"']} />
          </>
        ),
      },
    },
  },
  B5: {
    input: `:bridge1 :label "IJssel"@nl,\n         "IJssel"@en,\n         "IJssel"@de .`,
    outputs: {
      'suffix': {
        description: 'Separate property per language',
        visual: (
          <>
            <VisualNode label="Bridge" properties={['label_nl: "IJssel"', 'label_en: "IJssel"', 'label_de: "IJssel"']} />
          </>
        ),
      },
      'preferred': {
        description: 'Keep only preferred language (e.g., nl)',
        visual: (
          <>
            <VisualNode label="Bridge" properties={['label: "IJssel"']} />
          </>
        ),
      },
      'all': {
        description: 'Store all as array',
        visual: (
          <>
            <VisualNode label="Bridge" properties={['label: ["IJssel","IJssel","IJssel"]']} />
          </>
        ),
      },
      'nested': {
        description: 'Store as language map object',
        visual: (
          <>
            <VisualNode label="Bridge" properties={['label: {nl:"IJssel", en:"IJssel"}']} />
          </>
        ),
      },
    },
  },
  B6: {
    input: `:bridge1 :hasPart :deck1 .\n:deck1 a :BridgeDeck .`,
    outputs: {
      'property': {
        description: 'Edge type from property name',
        visual: (
          <VisualEdge from="Bridge" label="hasPart" to="BridgeDeck" />
        ),
      },
      'domain-range': {
        description: 'Include source-target in edge type',
        visual: (
          <VisualEdge from="Bridge" label="Bridge_hasPart_BridgeDeck" to="BridgeDeck" />
        ),
      },
      'generic': {
        description: 'All become generic relationship',
        visual: (
          <VisualEdge from="Bridge" label="relates_to" to="BridgeDeck" />
        ),
      },
    },
  },
  B7: {
    input: `:bridge1 :length "250"^^xsd:integer .\n:bridge1 :built "1936-01-15"^^xsd:date .`,
    outputs: {
      'strict': {
        description: 'Map to closest Fabric type',
        visual: (
          <>
            <VisualNode label="Bridge" properties={['length: 250 (int)', 'built: 1936-01-15 (date)']} />
          </>
        ),
      },
      'string': {
        description: 'All values as strings',
        visual: (
          <>
            <VisualNode label="Bridge" properties={['length: "250"', 'built: "1936-01-15"']} />
          </>
        ),
      },
      'infer': {
        description: 'Detect type from value patterns',
        visual: (
          <>
            <VisualNode label="Bridge" properties={['length: 250 (detected int)', 'built: "1936-01-15"']} />
          </>
        ),
      },
    },
  },
  B8: {
    input: `:bridge1 :name "IJssel" .\n:bridge1 :hasPart :deck1 .`,
    outputs: {
      'subject': {
        description: 'Properties on the subject node',
        visual: (
          <>
            <VisualNode label="Bridge" properties={['name: "IJssel"']} />
            <span style={{ margin: '0 8px' }}>→ hasPart →</span>
            <VisualNode label="Deck" />
          </>
        ),
      },
      'reified': {
        description: 'Support reified statements on edges',
        visual: (
          <>
            <VisualEdge from="Bridge" label="hasPart {since: 1936}" to="Deck" />
          </>
        ),
      },
      'both': {
        description: 'Copy properties to both',
        visual: (
          <Body2>Properties duplicated on node and edge</Body2>
        ),
      },
    },
  },
  B9: {
    input: `:bridge1 :status :Active .\n:Active a :Status .`,
    outputs: {
      'all-edges': {
        description: 'Status becomes separate node',
        visual: (
          <>
            <VisualNode label="Bridge" />
            <span style={{ margin: '0 8px' }}>→ status →</span>
            <VisualNode label="Status" properties={['uri: "Active"']} />
          </>
        ),
      },
      'enum-property': {
        description: 'Small enums become string property',
        visual: (
          <>
            <VisualNode label="Bridge" properties={['status: "Active"']} />
          </>
        ),
      },
      'threshold': {
        description: 'Types < N instances become properties',
        visual: (
          <>
            <VisualNode label="Bridge" properties={['status: "Active"']} />
          </>
        ),
      },
    },
  },
  B10: {
    input: `:parent owl:inverseOf :child .\n:bridge1 :hasPart :deck1 .`,
    outputs: {
      'materialize': {
        description: 'Create edges in both directions',
        visual: (
          <>
            <VisualEdge from="Bridge" label="hasPart" to="Deck" />
            <div style={{ margin: '8px 0' }} />
            <VisualEdge from="Deck" label="isPartOf" to="Bridge" />
          </>
        ),
      },
      'single': {
        description: 'Keep only declared direction',
        visual: (
          <VisualEdge from="Bridge" label="hasPart" to="Deck" />
        ),
      },
      'skip': {
        description: 'Ignore inverse declarations',
        visual: (
          <VisualEdge from="Bridge" label="hasPart" to="Deck" />
        ),
      },
    },
  },
  B11: {
    input: `<http://example.org/bridge/123>\n  rdfs:label "IJsselbrug" .`,
    outputs: {
      'local-name': {
        description: 'Use URI fragment as ID',
        visual: (
          <>
            <VisualNode label="Bridge" properties={['id: "123"']} />
          </>
        ),
      },
      'label': {
        description: 'Use rdfs:label as ID',
        visual: (
          <>
            <VisualNode label="Bridge" properties={['id: "IJsselbrug"']} />
          </>
        ),
      },
      'hash': {
        description: 'Hash the full URI',
        visual: (
          <>
            <VisualNode label="Bridge" properties={['id: "a1b2c3d4"']} />
          </>
        ),
      },
      'full': {
        description: 'Store complete URI as ID',
        visual: (
          <>
            <VisualNode label="Bridge" properties={['id: "http://example.org/bridge/123"']} />
          </>
        ),
      },
    },
  },
  B12: {
    input: `:SteelBridge rdfs:subClassOf :Bridge .\n:Bridge rdfs:subClassOf :Structure .`,
    outputs: {
      'flatten': {
        description: 'Ignore hierarchy, use leaf class',
        visual: (
          <>
            <VisualNode label="SteelBridge" />
          </>
        ),
      },
      'preserve': {
        description: 'Create hierarchy edges',
        visual: (
          <>
            <VisualNode label="SteelBridge" />
            <span style={{ margin: '0 8px' }}>→ subClassOf →</span>
            <VisualNode label="Bridge" />
            <span style={{ margin: '0 8px' }}>→ subClassOf →</span>
            <VisualNode label="Structure" />
          </>
        ),
      },
      'inherit': {
        description: 'Copy parent properties down',
        visual: (
          <>
            <VisualNode label="SteelBridge" properties={['(has Bridge props)', '(has Structure props)']} />
          </>
        ),
      },
    },
  },
};

interface DecisionExampleProps {
  decisionId: string;
  selectedOption?: string;
}

export function DecisionExample({ decisionId, selectedOption }: DecisionExampleProps) {
  const styles = useStyles();
  const example = DECISION_EXAMPLES[decisionId];
  
  if (!example) return null;
  
  const outputToShow = selectedOption && example.outputs[selectedOption] 
    ? { [selectedOption]: example.outputs[selectedOption] }
    : example.outputs;
  
  return (
    <div className={styles.container}>
      <div className={styles.title}>Example Transformation</div>
      
      <div className={styles.exampleRow}>
        <div className={styles.column}>
          <div className={styles.label}>RDF Input</div>
          <div className={styles.codeBlock}>{example.input}</div>
        </div>
      </div>
      
      {Object.entries(outputToShow).map(([optionValue, output]) => (
        <div key={optionValue} style={{ marginBottom: '12px' }}>
          <div className={styles.label}>
            {selectedOption ? 'Result' : `Option: ${optionValue}`} — {output.description}
          </div>
          <div className={styles.graphPreview}>
            {output.visual}
          </div>
        </div>
      ))}
    </div>
  );
}
