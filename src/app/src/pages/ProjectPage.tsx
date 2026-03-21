import { useParams, Navigate, useNavigate } from 'react-router-dom';
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
  Delete24Regular,
} from '@fluentui/react-icons';
import { useState, useMemo, useCallback } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { useAppStore } from '../stores/appStore';
import { FileBrowser, rdfFileFilter } from '../components/FileBrowser';
import { DecisionPanel, DECISION_DEFINITIONS, getDecisionStatus } from '../components/DecisionPanel';
import { TranslationPanel } from '../components/TranslationPanel';
import { ScenarioPreview } from '../components/ScenarioPreview';
import { NamespacePanel } from '../components/NamespacePanel';
import { FabricService } from '../services/fabricService';
import { detectNamespaces, mergeNamespaces, suggestSchemaLevel, type DetectedNamespace } from '../services/namespaceDetector';

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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '32px',
    textAlign: 'center',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px dashed ${tokens.colorNeutralStroke1}`,
  },
});

export function ProjectPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedTab, setSelectedTab] = useState('source');
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [browseMode, setBrowseMode] = useState<'rdf' | 'schema'>('rdf');
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [isDetectingNamespaces, setIsDetectingNamespaces] = useState(false);

  // Auth and Fabric service
  const { instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const { workspaceId, lakehouseId } = useAppStore();
  
  const fabricService = useMemo(
    () => isAuthenticated ? new FabricService(instance) : null,
    [isAuthenticated, instance]
  );
  
  const { projects, updateProject, deleteProject } = useAppStore();
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

  // Detect namespaces from RDF and schema files
  const detectNamespacesFromFiles = useCallback(async (rdfFiles: string[], schemaFiles: string[]) => {
    if (!fabricService || !workspaceId || !lakehouseId) {
      return;
    }

    const allFiles = [...rdfFiles, ...schemaFiles];
    if (allFiles.length === 0) {
      updateProject(project.id, { detectedNamespaces: [] });
      return;
    }

    setIsDetectingNamespaces(true);
    try {
      const allNamespaces: DetectedNamespace[][] = [];

      for (const filePath of allFiles) {
        // Extract relative path from full OneLake path
        // filePath format: "folder/subfolder/file.ttl"
        const content = await fabricService.readOneLakeFile(workspaceId, lakehouseId, filePath);
        if (content) {
          const fileName = filePath.split('/').pop() || filePath;
          const namespaces = detectNamespaces(fileName, content);
          allNamespaces.push(namespaces);
        }
      }

      // Merge and deduplicate namespaces from all files
      const merged = mergeNamespaces(allNamespaces);
      updateProject(project.id, { detectedNamespaces: merged });
    } catch (error) {
      console.error('Failed to detect namespaces:', error);
    } finally {
      setIsDetectingNamespaces(false);
    }
  }, [fabricService, workspaceId, lakehouseId, project.id, updateProject]);

  const handleConfirmSelection = async () => {
    const newRdfFiles = browseMode === 'rdf' 
      ? [...project.source.files, ...pendingFiles]
      : project.source.files;
    const newSchemaFiles = browseMode === 'schema'
      ? [...project.source.schemaFiles, ...pendingFiles]
      : project.source.schemaFiles;

    if (browseMode === 'rdf') {
      updateProject(project.id, { 
        source: { ...project.source, files: newRdfFiles }
      });
    } else {
      updateProject(project.id, { 
        source: { ...project.source, schemaFiles: newSchemaFiles }
      });
    }
    
    // Detect namespaces for all files (RDF + schema)
    detectNamespacesFromFiles(newRdfFiles, newSchemaFiles);
    
    setShowFileBrowser(false);
    setPendingFiles([]);
  };

  const handleRemoveFile = (filePath: string, type: 'rdf' | 'schema') => {
    let newRdfFiles = project.source.files;
    let newSchemaFiles = project.source.schemaFiles;
    
    if (type === 'rdf') {
      newRdfFiles = project.source.files.filter(f => f !== filePath);
      updateProject(project.id, {
        source: { ...project.source, files: newRdfFiles }
      });
    } else {
      newSchemaFiles = project.source.schemaFiles.filter(f => f !== filePath);
      updateProject(project.id, {
        source: { ...project.source, schemaFiles: newSchemaFiles }
      });
    }
    
    // Re-detect namespaces from all remaining files
    detectNamespacesFromFiles(newRdfFiles, newSchemaFiles);
  };

  // Queue external ontologies for notebook to fetch (avoids browser CORS issues)
  const handleQueueForFetch = useCallback(async (uris: string[]): Promise<boolean> => {
    if (!fabricService || !workspaceId || !lakehouseId) {
      console.error('Fabric connection not available');
      return false;
    }
    
    try {
      const manifest = {
        uris: uris,
        created_at: new Date().toISOString(),
        project_id: project.id,
        project_name: project.name,
        instructions: 'Run notebook 12_external_ontology_fetcher.ipynb in Fabric to fetch these ontologies'
      };
      
      await fabricService.writeOneLakeFile(
        workspaceId,
        lakehouseId,
        'cache/fetch_manifest.json',
        JSON.stringify(manifest, null, 2)
      );
      
      console.log(`Wrote fetch manifest for ${uris.length} URIs`);
      return true;
    } catch (error) {
      console.error('Failed to write fetch manifest:', error);
      return false;
    }
  }, [fabricService, workspaceId, lakehouseId, project.id, project.name]);

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

  const handleDelete = () => {
    deleteProject(project.id);
    setShowDeleteDialog(false);
    navigate('/');
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
            <Button
              appearance="subtle"
              icon={<Delete24Regular />}
              onClick={() => setShowDeleteDialog(true)}
              title="Delete project"
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

          <Divider />

          <div className={styles.section} style={{ marginTop: '24px' }}>
            <div className={styles.sectionTitle}>
              <DataTreemap24Regular />
              <Title3>Schema Level</Title3>
            </div>
            
            <Body2 style={{ marginBottom: '12px', color: tokens.colorNeutralForeground2 }}>
              Select the richness of your RDF schema. This determines which translation decisions 
              can be auto-resolved.
            </Body2>

            {/* Schema Level Suggestion */}
            {(() => {
              const suggestion = suggestSchemaLevel(project.detectedNamespaces);
              if (suggestion.level !== null && project.schemaLevel === null) {
                return (
                  <div style={{
                    padding: '12px 16px',
                    marginBottom: '12px',
                    backgroundColor: tokens.colorNeutralBackground3,
                    borderRadius: tokens.borderRadiusMedium,
                    border: `1px solid ${tokens.colorBrandStroke1}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}>
                    <Flash24Regular style={{ color: tokens.colorBrandForeground1 }} />
                    <div style={{ flex: 1 }}>
                      <Body2 style={{ fontWeight: 600 }}>
                        Suggested: Level {suggestion.level}
                      </Body2>
                      <Body2 style={{ color: tokens.colorNeutralForeground2, fontSize: '12px' }}>
                        {suggestion.reason} ({suggestion.confidence} confidence)
                      </Body2>
                    </div>
                    <Button 
                      appearance="primary" 
                      size="small"
                      onClick={() => updateProject(project.id, { schemaLevel: suggestion.level })}
                    >
                      Apply
                    </Button>
                  </div>
                );
              }
              return null;
            })()}

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

          {/* Detected Namespaces Panel */}
          <NamespacePanel 
            namespaces={project.detectedNamespaces}
            isLoading={isDetectingNamespaces}
            onRefresh={() => detectNamespacesFromFiles(project.source.files, project.source.schemaFiles)}
            onQueueForFetch={fabricService ? handleQueueForFetch : undefined}
          />
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
                Schema Levels:
              </Body2>
              <Button
                appearance={project.schemaLevel === 0 ? 'primary' : 'secondary'}
                size="small"
                onClick={() => {
                  updateProject(project.id, { schemaLevel: 0, decisions: {} });
                }}
              >
                Level 0 — RDF (12)
              </Button>
              <Button
                appearance={project.schemaLevel === 1 ? 'primary' : 'secondary'}
                size="small"
                onClick={() => {
                  updateProject(project.id, { schemaLevel: 1, decisions: {} });
                }}
              >
                Level 1 — SKOS (11)
              </Button>
              <Button
                appearance={project.schemaLevel === 2 ? 'primary' : 'secondary'}
                size="small"
                onClick={() => {
                  updateProject(project.id, { schemaLevel: 2, decisions: {} });
                }}
              >
                Level 2 — RDFS (8)
              </Button>
              <Button
                appearance={project.schemaLevel === 3 ? 'primary' : 'secondary'}
                size="small"
                onClick={() => {
                  updateProject(project.id, { schemaLevel: 3, decisions: {} });
                }}
              >
                Level 3 — OWL (6)
              </Button>
              <Button
                appearance={project.schemaLevel === 4 ? 'primary' : 'secondary'}
                size="small"
                onClick={() => {
                  updateProject(project.id, { schemaLevel: 4, decisions: {} });
                }}
              >
                Level 4 — SHACL (5)
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
            sourceFiles={project.source.files}
            schemaLevel={project.schemaLevel ?? null}
            decisions={project.decisions as Record<string, string>}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(_, data) => setShowDeleteDialog(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogContent>
              <Body1>
                Are you sure you want to delete <strong>{project.name}</strong>?
              </Body1>
              <Body2 style={{ marginTop: '12px', color: tokens.colorNeutralForeground3 }}>
                This will remove the project from the app. Data uploaded to Fabric (source files, Delta tables, ontology) will remain in the Lakehouse.
              </Body2>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
              <Button 
                appearance="primary" 
                onClick={handleDelete}
                style={{ backgroundColor: tokens.colorPaletteRedBackground3 }}
              >
                Delete Project
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
