import { useParams, Navigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Card,
  Title2,
  Title3,
  Body1,
  Button,
  Badge,
  Divider,
  Tab,
  TabList,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@fluentui/react-components';
import {
  DocumentMultiple24Regular,
  DataTreemap24Regular,
  Play24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  FolderOpen24Regular,
} from '@fluentui/react-icons';
import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { FileBrowser, rdfFileFilter } from '../components/FileBrowser';

const useStyles = makeStyles({
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  tabs: {
    marginBottom: '24px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
  },
  card: {
    padding: '16px',
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
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  emptyFiles: {
    padding: '32px',
    textAlign: 'center',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px dashed ${tokens.colorNeutralStroke1}`,
  },
  decisionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  decisionCard: {
    padding: '12px',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  decisionPending: {
    border: `1px solid ${tokens.colorPaletteYellowBorder1}`,
    backgroundColor: tokens.colorPaletteYellowBackground1,
  },
  decisionComplete: {
    border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
});

// Placeholder decision categories
const DECISIONS = [
  { id: 'B1', name: 'Node Type Mapping', description: 'How to map OWL classes to node types' },
  { id: 'B2', name: 'Property Mapping', description: 'How to handle datatype properties' },
  { id: 'B3', name: 'Edge Type Mapping', description: 'How to map object properties' },
  { id: 'B4', name: 'Blank Nodes', description: 'How to handle anonymous resources' },
  { id: 'B5', name: 'Multi-valued Properties', description: 'Arrays vs separate nodes' },
  { id: 'B6', name: 'Language Tags', description: 'How to handle multilingual literals' },
  { id: 'B7', name: 'Datatypes', description: 'RDF to Fabric type mapping' },
  { id: 'B8', name: 'Named Graphs', description: 'How to handle graph context' },
  { id: 'B9', name: 'Class Hierarchy', description: 'Flatten or preserve' },
  { id: 'B10', name: 'IRI Handling', description: 'Full URI vs local name' },
  { id: 'B11', name: 'Validation', description: 'Pre-load SHACL validation' },
  { id: 'B12', name: 'Provenance', description: 'Track source information' },
];

export function ProjectPage() {
  const styles = useStyles();
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedTab, setSelectedTab] = useState('source');
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [browseMode, setBrowseMode] = useState<'rdf' | 'schema'>('rdf');
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  
  const { projects, updateProject } = useAppStore();
  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    return <Navigate to="/" replace />;
  }

  const completedDecisions = Object.keys(project.decisions).length;

  const handleBrowseFiles = (mode: 'rdf' | 'schema') => {
    setBrowseMode(mode);
    setPendingFiles([]);
    setShowFileBrowser(true);
  };

  const handleFileSelectionChange = (files: string[]) => {
    setPendingFiles(files);
  };

  const handleConfirmSelection = () => {
    if (browseMode === 'rdf') {
      updateProject(project.id, { 
        source: { ...project.source, files: [...project.source.files, ...pendingFiles] }
      });
    } else {
      updateProject(project.id, { 
        source: { ...project.source, schemaFiles: [...project.source.schemaFiles, ...pendingFiles] }
      });
    }
    setShowFileBrowser(false);
    setPendingFiles([]);
  };

  const handleRemoveFile = (filePath: string, type: 'rdf' | 'schema') => {
    if (type === 'rdf') {
      updateProject(project.id, {
        source: { ...project.source, files: project.source.files.filter(f => f !== filePath) }
      });
    } else {
      updateProject(project.id, {
        source: { ...project.source, schemaFiles: project.source.schemaFiles.filter(f => f !== filePath) }
      });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Title2>{project.name}</Title2>
          <Body1>
            <Badge appearance="filled" color="informative">
              {project.status}
            </Badge>
            {' · '}
            Schema Level: {project.schemaLevel ?? 'Not detected'}
            {' · '}
            Decisions: {completedDecisions}/12
          </Body1>
        </div>
        <Button
          appearance="primary"
          icon={<Play24Regular />}
          disabled={project.source.files.length === 0}
        >
          Run Translation
        </Button>
      </div>

      <TabList
        selectedValue={selectedTab}
        onTabSelect={(_, data) => setSelectedTab(data.value as string)}
        className={styles.tabs}
      >
        <Tab value="source" icon={<DocumentMultiple24Regular />}>
          Source Files
        </Tab>
        <Tab value="decisions" icon={<DataTreemap24Regular />}>
          Decisions ({completedDecisions}/12)
        </Tab>
        <Tab value="preview" icon={<Checkmark24Regular />}>
          Preview
        </Tab>
      </TabList>

      {selectedTab === 'source' && (
        <Card className={styles.card}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <DocumentMultiple24Regular />
              <Title3>RDF Source Files</Title3>
            </div>
            
            {project.source.files.length === 0 ? (
              <div className={styles.emptyFiles}>
                <Body1>No files selected yet.</Body1>
                <Button 
                  appearance="primary" 
                  icon={<FolderOpen24Regular />}
                  style={{ marginTop: '16px' }}
                  onClick={() => handleBrowseFiles('rdf')}
                >
                  Browse Lakehouse Files
                </Button>
              </div>
            ) : (
              <div className={styles.fileList}>
                {project.source.files.map((file, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Body1 style={{ flex: 1 }}>{file}</Body1>
                    <Button size="small" appearance="subtle" onClick={() => handleRemoveFile(file, 'rdf')}>
                      <Dismiss24Regular />
                    </Button>
                  </div>
                ))}
                <Button 
                  appearance="secondary" 
                  icon={<FolderOpen24Regular />}
                  style={{ marginTop: '8px' }}
                  onClick={() => handleBrowseFiles('rdf')}
                >
                  Add More Files
                </Button>
              </div>
            )}
          </div>

          <Divider />

          <div className={styles.section} style={{ marginTop: '24px' }}>
            <div className={styles.sectionTitle}>
              <DataTreemap24Regular />
              <Title3>Schema Files (Optional)</Title3>
            </div>
            
            {project.source.schemaFiles.length === 0 ? (
              <div className={styles.emptyFiles}>
                <Body1>No schema files selected. Schema will be inferred from data.</Body1>
                <Button 
                  appearance="secondary" 
                  icon={<FolderOpen24Regular />}
                  style={{ marginTop: '16px' }}
                  onClick={() => handleBrowseFiles('schema')}
                >
                  Add Schema Files
                </Button>
              </div>
            ) : (
              <div className={styles.fileList}>
                {project.source.schemaFiles.map((file, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Body1 style={{ flex: 1 }}>{file}</Body1>
                    <Button size="small" appearance="subtle" onClick={() => handleRemoveFile(file, 'schema')}>
                      <Dismiss24Regular />
                    </Button>
                  </div>
                ))}
                <Button 
                  appearance="secondary" 
                  icon={<FolderOpen24Regular />}
                  style={{ marginTop: '8px' }}
                  onClick={() => handleBrowseFiles('schema')}
                >
                  Add More Schema Files
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {selectedTab === 'decisions' && (
        <Card className={styles.card}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <DataTreemap24Regular />
              <Title3>Translation Decisions</Title3>
            </div>
            <Body1 style={{ marginBottom: '16px' }}>
              Configure how RDF constructs should be translated to Fabric Graph.
              Some decisions are auto-resolved based on detected schema level.
            </Body1>
            
            <div className={styles.decisionGrid}>
              {DECISIONS.map((decision) => {
                const isComplete = decision.id in project.decisions;
                return (
                  <div
                    key={decision.id}
                    className={`${styles.decisionCard} ${
                      isComplete ? styles.decisionComplete : styles.decisionPending
                    }`}
                  >
                    <Body1 style={{ fontWeight: 600 }}>{decision.id}: {decision.name}</Body1>
                    <Caption1>{decision.description}</Caption1>
                    <Badge
                      appearance="tint"
                      color={isComplete ? 'success' : 'warning'}
                      style={{ marginTop: '8px' }}
                    >
                      {isComplete ? 'Configured' : 'Pending'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {selectedTab === 'preview' && (
        <Card className={styles.card}>
          <div className={styles.emptyFiles}>
            <Body1>Graph preview will appear here after running schema detection.</Body1>
            <Button appearance="primary" style={{ marginTop: '16px' }}>
              Detect Schema
            </Button>
          </div>
        </Card>
      )}

      {/* File Browser Dialog */}
      <Dialog open={showFileBrowser} onOpenChange={(_, data) => setShowFileBrowser(data.open)}>
        <DialogSurface style={{ maxWidth: '800px', width: '90vw' }}>
          <DialogBody>
            <DialogTitle>
              {browseMode === 'rdf' ? 'Select RDF Source Files' : 'Select Schema Files'}
            </DialogTitle>
            <DialogContent>
              <FileBrowser
                onSelectionChange={handleFileSelectionChange}
                filter={rdfFileFilter}
              />
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setShowFileBrowser(false)}>
                Cancel
              </Button>
              <Button 
                appearance="primary" 
                onClick={handleConfirmSelection}
                disabled={pendingFiles.length === 0}
              >
                Add {pendingFiles.length} File{pendingFiles.length !== 1 ? 's' : ''}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

// Helper for Caption1 import
function Caption1({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <Body1 style={{ fontSize: '12px', color: tokens.colorNeutralForeground2, ...style }}>{children}</Body1>;
}
