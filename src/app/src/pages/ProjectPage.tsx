import { useParams, Navigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Card,
  Title2,
  Title3,
  Body1,
  Body2,
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
  Dropdown,
  Option,
  Field,
  Input,
} from '@fluentui/react-components';
import {
  DocumentMultiple24Regular,
  DataTreemap24Regular,
  Play24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  FolderOpen24Regular,
  Edit24Regular,
  Flash24Regular,
} from '@fluentui/react-icons';
import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { FileBrowser, rdfFileFilter } from '../components/FileBrowser';
import { DecisionPanel, DECISION_DEFINITIONS, getDecisionStatus } from '../components/DecisionPanel';
import { TranslationPanel } from '../components/TranslationPanel';
import { ScenarioPreview } from '../components/ScenarioPreview';

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
});

export function ProjectPage() {
  const styles = useStyles();
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedTab, setSelectedTab] = useState('source');
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [browseMode, setBrowseMode] = useState<'rdf' | 'schema'>('rdf');
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newName, setNewName] = useState('');
  
  const { projects, updateProject } = useAppStore();
  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    return <Navigate to="/" replace />;
  }

  const completedDecisions = Object.keys(project.decisions).length;
  const autoDecisions = DECISION_DEFINITIONS.filter(d => getDecisionStatus(d, project.schemaLevel) === 'auto').length;
  const manualRemaining = DECISION_DEFINITIONS.filter(d => 
    getDecisionStatus(d, project.schemaLevel) !== 'auto' && !(d.id in project.decisions)
  ).length;

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

  const handleDecisionChange = (decisionId: string, value: string) => {
    updateProject(project.id, {
      decisions: { ...project.decisions, [decisionId]: value }
    });
  };

  const openRenameDialog = () => {
    setNewName(project.name);
    setShowRenameDialog(true);
  };

  const handleRename = () => {
    const trimmedName = newName.trim();
    if (trimmedName && trimmedName !== project.name) {
      updateProject(project.id, { name: trimmedName });
    }
    setShowRenameDialog(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Title2>{project.name}</Title2>
            <Button
              appearance="subtle"
              icon={<Edit24Regular />}
              onClick={openRenameDialog}
              title="Rename project"
            />
          </div>
          <Body1>
            <Badge appearance="filled" color="informative">
              {project.status}
            </Badge>
            {' · '}
            Schema Level: {project.schemaLevel ?? 'Not detected'}
            {' · '}
            Decisions: {autoDecisions} auto, {completedDecisions} configured
            {manualRemaining > 0 && `, ${manualRemaining} remaining`}
          </Body1>
        </div>
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
          Decisions ({manualRemaining > 0 ? `${manualRemaining} remaining` : '✓ Ready'})
        </Tab>
        <Tab value="preview" icon={<Checkmark24Regular />}>
          Preview
        </Tab>
        <Tab value="execute" icon={<Play24Regular />}>
          Execute
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
              <Title3>Schema Level</Title3>
            </div>
            
            <Body2 style={{ marginBottom: '12px', color: tokens.colorNeutralForeground2 }}>
              Select the richness of your RDF schema. This determines which translation decisions 
              can be auto-resolved. A future version will auto-detect this from your files.
            </Body2>

            <Field label="Schema Level">
              <Dropdown
                placeholder="Select schema level"
                value={
                  project.schemaLevel === null ? 'Not detected' :
                  project.schemaLevel === 0 ? 'Level 0 - Instance data only' :
                  project.schemaLevel === 1 ? 'Level 1 - SKOS vocabulary' :
                  project.schemaLevel === 2 ? 'Level 2 - RDFS schema' :
                  project.schemaLevel === 3 ? 'Level 3 - OWL ontology' :
                  'Level 4 - SHACL shapes'
                }
                selectedOptions={project.schemaLevel !== null ? [String(project.schemaLevel)] : []}
                onOptionSelect={(_, data) => {
                  const level = data.optionValue ? parseInt(data.optionValue) : null;
                  updateProject(project.id, { schemaLevel: level });
                }}
                style={{ maxWidth: '300px' }}
              >
                <Option value="0">Level 0 - Instance data only (12 manual decisions)</Option>
                <Option value="1">Level 1 - SKOS vocabulary (11 manual decisions)</Option>
                <Option value="2">Level 2 - RDFS schema (8 manual decisions)</Option>
                <Option value="3">Level 3 - OWL ontology (6 manual decisions)</Option>
                <Option value="4">Level 4 - SHACL shapes (5 manual decisions)</Option>
              </Dropdown>
            </Field>
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
              Click on any decision card to configure it.
              {project.schemaLevel !== null && project.schemaLevel > 0 && (
                <span style={{ fontWeight: 600 }}>
                  {' '}Schema Level {project.schemaLevel} detected — some decisions are auto-resolved.
                </span>
              )}
            </Body1>

            {/* Scenario Presets */}
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              marginBottom: '24px',
              padding: '16px',
              backgroundColor: tokens.colorNeutralBackground3,
              borderRadius: tokens.borderRadiusMedium,
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <Body2 style={{ fontWeight: 600, marginRight: '8px' }}>
                <Flash24Regular style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Quick Scenarios:
              </Body2>
              <Button
                appearance={project.schemaLevel === 0 ? 'primary' : 'secondary'}
                size="small"
                onClick={() => {
                  updateProject(project.id, { schemaLevel: 0, decisions: {} });
                }}
              >
                Scenario A — No Schema (12 decisions)
              </Button>
              <Button
                appearance={project.schemaLevel === 2 ? 'primary' : 'secondary'}
                size="small"
                onClick={() => {
                  updateProject(project.id, { schemaLevel: 2, decisions: {} });
                }}
              >
                Scenario C — RDFS (8 decisions)
              </Button>
              <Button
                appearance={project.schemaLevel === 4 ? 'primary' : 'secondary'}
                size="small"
                onClick={() => {
                  updateProject(project.id, { schemaLevel: 4, decisions: {} });
                }}
              >
                Scenario E — SHACL (5 decisions)
              </Button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: tokens.colorNeutralForeground3, fontSize: '12px' }}>
              <Flash24Regular style={{ fontSize: '14px' }} />
              <span>Settings are automatically saved • Last updated: {new Date(project.updated).toLocaleTimeString()}</span>
            </div>
            
            <DecisionPanel
              schemaLevel={project.schemaLevel}
              decisions={project.decisions as Record<string, string>}
              onDecisionChange={handleDecisionChange}
            />
          </div>
        </Card>
      )}

      {selectedTab === 'execute' && (
        <Card className={styles.card}>
          <TranslationPanel 
            projectId={project.id}
            projectName={project.name}
            onComplete={() => {
              updateProject(project.id, { status: 'translated' });
            }}
          />
        </Card>
      )}

      {selectedTab === 'preview' && (
        <Card className={styles.card}>
          <ScenarioPreview 
            decisions={project.decisions as Record<string, string>} 
            schemaLevel={project.schemaLevel ?? null}
          />
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

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={(_, data) => setShowRenameDialog(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogContent>
              <Field label="Project Name" required>
                <Input
                  value={newName}
                  onChange={(_, data) => setNewName(data.value)}
                  placeholder="Enter project name"
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setShowRenameDialog(false)}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={handleRename}>
                Rename
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
