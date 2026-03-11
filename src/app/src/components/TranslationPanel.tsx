/**
 * Translation Panel Component
 * 
 * Displays translation pipeline execution with real-time progress tracking.
 * Runs notebooks NB01-NB09 in sequence and shows status for each step.
 */

import { useCallback, useMemo } from 'react';
import { useMsal } from '@azure/msal-react';
import {
  makeStyles,
  tokens,
  Button,
  Body1,
  Body2,
  Badge,
  Spinner,
  ProgressBar,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
} from '@fluentui/react-components';
import {
  Play24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  Clock24Regular,
  ArrowClockwise24Regular,
  Stop24Regular,
} from '@fluentui/react-icons';
import { FabricService, TRANSLATION_PIPELINE, NotebookJob, PipelineConfig } from '../services/fabricService';
import { useAppStore, StepState } from '../stores/appStore';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressSection: {
    padding: '16px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  stepList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '16px',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  stepRunning: {
    borderLeftColor: tokens.colorBrandStroke1,
    backgroundColor: tokens.colorBrandBackground2,
  },
  stepCompleted: {
    borderLeftColor: tokens.colorPaletteGreenBorder1,
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  stepFailed: {
    borderLeftColor: tokens.colorPaletteRedBorder1,
    backgroundColor: tokens.colorPaletteRedBackground1,
  },
  stepIcon: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  stepTime: {
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
  },
  logSection: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    fontFamily: 'monospace',
    fontSize: '12px',
    maxHeight: '200px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
});

interface TranslationPanelProps {
  projectId: string;
  projectName: string;
  sourceFiles: string[];
  schemaLevel: number | null;
  decisions: Record<string, string>;
  onComplete?: () => void;
}

export function TranslationPanel({ projectId, projectName, sourceFiles, schemaLevel, decisions, onComplete }: TranslationPanelProps) {
  const styles = useStyles();
  const { 
    workspaceId, 
    lakehouseId,
    pipelineExecution,
    startPipelineExecution,
    updatePipelineStep,
    addPipelineLog,
    setPipelineStatus,
  } = useAppStore();
  
  // Derive state from global store
  const isRunning = pipelineExecution?.projectId === projectId && pipelineExecution.isRunning;
  const stepStates = pipelineExecution?.projectId === projectId ? pipelineExecution.stepStates : {};
  const logs = pipelineExecution?.projectId === projectId ? pipelineExecution.logs : [];
  const overallStatus = pipelineExecution?.projectId === projectId ? pipelineExecution.overallStatus : 'idle';
  const errorMessage = pipelineExecution?.projectId === projectId ? pipelineExecution.errorMessage : null;

  // Create FabricService instance (same pattern as SettingsPage)
  const { instance } = useMsal();
  const fabricService = useMemo(() => new FabricService(instance), [instance]);

  const addLog = useCallback((message: string) => {
    addPipelineLog(message);
  }, [addPipelineLog]);

  const updateStepState = useCallback((stepId: string, update: Partial<StepState>) => {
    updatePipelineStep(stepId, update);
  }, [updatePipelineStep]);

  const runPipeline = async () => {
    if (!workspaceId) {
      setPipelineStatus('failed', 'Workspace not configured. Go to Settings to configure workspace.');
      return;
    }

    if (!lakehouseId) {
      setPipelineStatus('failed', 'Lakehouse not configured. Go to Settings to configure lakehouse.');
      return;
    }

    // Initialize pipeline execution in global store
    startPipelineExecution(projectId);
    
    // Reset step states
    TRANSLATION_PIPELINE.forEach(step => {
      updateStepState(step.id, { status: 'pending' });
    });

    const outputFolder = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
    addLog('Starting translation pipeline...');
    addLog(`Workspace: ${workspaceId}`);
    addLog(`Lakehouse: ${lakehouseId}`);

    try {
      // Step 1: Create workspace folder for output items
      addLog(`Creating workspace folder: ${outputFolder}/`);
      let folderId: string | null = null;
      try {
        const folder = await fabricService.findOrCreateFolder(workspaceId, outputFolder);
        folderId = folder.id;
        addLog(`✓ Folder ready: ${folder.displayName} (${folder.id})`);
      } catch (folderError) {
        addLog(`⚠️ Could not create folder: ${folderError instanceof Error ? folderError.message : 'Unknown error'}`);
        addLog('  Continuing without folder - items will be created at workspace root');
      }

      // Step 2: Write pipeline configuration to OneLake
      addLog('Writing pipeline configuration...');
      const pipelineConfig: PipelineConfig = {
        project_name: projectName,
        folder_id: folderId,
        created_at: new Date().toISOString(),
        created_by: 'app',
        source: {
          files: sourceFiles,
          schema_level: schemaLevel,
        },
        decisions,
      };
      try {
        await fabricService.writePipelineConfig(workspaceId, lakehouseId, pipelineConfig);
        addLog('✓ Pipeline config written to Files/config/pipeline_run.json');
        addLog(`  Project: ${projectName}`);
        addLog(`  Schema Level: ${schemaLevel}`);
        addLog(`  Decisions: ${Object.keys(decisions).length} configured`);
      } catch (configError) {
        addLog(`⚠️ Could not write config: ${configError instanceof Error ? configError.message : 'Unknown error'}`);
        addLog('  Notebooks will use default settings');
      }

      // Step 3: Find all notebooks
      addLog('Discovering notebooks...');
      const notebooks = await fabricService.listNotebooks(workspaceId);
      addLog(`Found ${notebooks.length} notebooks in workspace`);

      // Run each step
      for (let i = 0; i < TRANSLATION_PIPELINE.length; i++) {
        const step = TRANSLATION_PIPELINE[i];
        
        // Find notebook
        const notebook = notebooks.find(nb => nb.displayName === step.notebookName);
        if (!notebook) {
          addLog(`⚠️ Notebook '${step.notebookName}' not found - skipping ${step.id}`);
          updateStepState(step.id, { status: 'skipped' });
          continue;
        }

        addLog(`▶ Running ${step.id}: ${step.name}`);
        updateStepState(step.id, { status: 'running', startTime: Date.now() });

        try {
          // Start the notebook job
          const job = await fabricService.runNotebook(workspaceId, notebook.id);
          updateStepState(step.id, { jobId: job.id });
          addLog(`  Job started: ${job.id}`);

          // Wait for completion
          const finalJob = await fabricService.waitForJob(
            workspaceId,
            notebook.id,
            job.id,
            (status: NotebookJob) => {
              addLog(`  Status: ${status.status}`);
            },
            10000 // Poll every 10 seconds
          );

          const endTime = Date.now();
          
          if (finalJob.status === 'Completed') {
            updateStepState(step.id, { 
              status: 'completed', 
              endTime 
            });
            addLog(`✓ ${step.id} completed`);
          } else {
            updateStepState(step.id, { 
              status: 'failed', 
              endTime,
              error: finalJob.failureReason?.message || 'Unknown error'
            });
            addLog(`✗ ${step.id} failed: ${finalJob.failureReason?.message || 'Unknown error'}`);
            throw new Error(`Step ${step.id} failed: ${finalJob.failureReason?.message}`);
          }
        } catch (stepError) {
          const endTime = Date.now();
          const errorMsg = stepError instanceof Error ? stepError.message : 'Unknown error';
          updateStepState(step.id, { 
            status: 'failed', 
            endTime,
            error: errorMsg
          });
          addLog(`✗ ${step.id} failed: ${errorMsg}`);
          throw stepError;
        }
      }

      // All steps completed
      setPipelineStatus('completed');
      addLog('✓ Translation pipeline completed successfully!');
      
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Pipeline failed';
      setPipelineStatus('failed', errorMsg);
      addLog(`✗ Pipeline failed: ${errorMsg}`);
    }
  };

  const getStepIcon = (stepId: string) => {
    const state = stepStates[stepId];
    if (!state || state.status === 'pending') {
      return <Clock24Regular style={{ color: tokens.colorNeutralForeground3 }} />;
    }
    switch (state.status) {
      case 'running':
        return <Spinner size="tiny" />;
      case 'completed':
        return <Checkmark24Regular style={{ color: tokens.colorPaletteGreenForeground1 }} />;
      case 'failed':
        return <Dismiss24Regular style={{ color: tokens.colorPaletteRedForeground1 }} />;
      case 'skipped':
        return <ArrowClockwise24Regular style={{ color: tokens.colorNeutralForeground3 }} />;
      default:
        return <Clock24Regular style={{ color: tokens.colorNeutralForeground3 }} />;
    }
  };

  const getStepClass = (stepId: string) => {
    const state = stepStates[stepId];
    if (!state) return styles.step;
    
    let className = styles.step;
    if (state.status === 'running') className += ` ${styles.stepRunning}`;
    else if (state.status === 'completed') className += ` ${styles.stepCompleted}`;
    else if (state.status === 'failed') className += ` ${styles.stepFailed}`;
    return className;
  };

  const formatDuration = (startTime?: number, endTime?: number) => {
    if (!startTime) return '';
    const end = endTime || Date.now();
    const seconds = Math.round((end - startTime) / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  const completedSteps = Object.values(stepStates).filter(s => s.status === 'completed').length;
  const progress = TRANSLATION_PIPELINE.length > 0 ? completedSteps / TRANSLATION_PIPELINE.length : 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Body1>Run the translation pipeline to convert RDF data to Fabric Graph.</Body1>
        <Button
          appearance="primary"
          icon={isRunning ? <Stop24Regular /> : <Play24Regular />}
          onClick={runPipeline}
          disabled={isRunning}
        >
          {isRunning ? 'Running...' : 'Run Translation'}
        </Button>
      </div>

      {errorMessage && (
        <MessageBar intent="error">
          <MessageBarBody>
            <MessageBarTitle>Error</MessageBarTitle>
            {errorMessage}
          </MessageBarBody>
        </MessageBar>
      )}

      {overallStatus === 'completed' && (
        <MessageBar intent="success">
          <MessageBarBody>
            <MessageBarTitle>Success</MessageBarTitle>
            Translation completed! Your RDF data has been loaded into Fabric Graph.
          </MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.progressSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <Body2 style={{ fontWeight: 600 }}>Pipeline Progress</Body2>
          <Badge appearance="filled" color={overallStatus === 'completed' ? 'success' : overallStatus === 'failed' ? 'danger' : 'informative'}>
            {completedSteps} / {TRANSLATION_PIPELINE.length} steps
          </Badge>
        </div>
        <ProgressBar value={progress} />

        <div className={styles.stepList}>
          {TRANSLATION_PIPELINE.map((step) => {
            const state = stepStates[step.id];
            return (
              <div key={step.id} className={getStepClass(step.id)}>
                <div className={styles.stepIcon}>
                  {getStepIcon(step.id)}
                </div>
                <div className={styles.stepInfo}>
                  <Body2 style={{ fontWeight: 600 }}>{step.id}: {step.name}</Body2>
                  <Body1 style={{ color: tokens.colorNeutralForeground3, fontSize: '12px' }}>{step.description}</Body1>
                  {state?.error && (
                    <Body1 style={{ color: tokens.colorPaletteRedForeground1, fontSize: '11px', wordBreak: 'break-word' }}>
                      {state.error.length > 100 ? state.error.substring(0, 100) + '...' : state.error}
                    </Body1>
                  )}
                </div>
                {state?.startTime && (
                  <span className={styles.stepTime}>
                    {formatDuration(state.startTime, state.endTime)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {logs.length > 0 && (
        <>
          <Body2 style={{ fontWeight: 600 }}>Execution Log</Body2>
          <div className={styles.logSection}>
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
