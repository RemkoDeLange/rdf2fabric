/**
 * Translation Panel Component
 * 
 * Displays translation pipeline execution with real-time progress tracking.
 * Runs notebooks NB01-NB09 in sequence and shows status for each step.
 */

import { useCallback, useMemo, useEffect, useRef } from 'react';
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
import { FabricService, TRANSLATION_PIPELINE, PipelineConfig } from '../services/fabricService';
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

// Polling interval in milliseconds
const POLL_INTERVAL_MS = 10000;

export function TranslationPanel({ projectId, projectName, sourceFiles, schemaLevel, decisions, onComplete }: TranslationPanelProps) {
  const styles = useStyles();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { 
    workspaceId, 
    lakehouseId,
    pipelineExecution,
    startPipelineExecution,
    updatePipelineStep,
    addPipelineLog,
    setPipelineStatus,
    clearPipelineExecution,
  } = useAppStore();
  
  // Derive state from global store
  const isRunning = pipelineExecution?.projectId === projectId && pipelineExecution.isRunning;
  
  // Detect stale running state (running but no update in last 2 minutes)
  const isStale = isRunning && pipelineExecution?.lastUpdated && 
    (Date.now() - pipelineExecution.lastUpdated > 120000);
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

  // Track last known state for log deduplication
  const lastLoggedStep = useRef<string | null>(null);
  const lastLoggedCompleted = useRef<number>(0);

  // Poll progress file and update UI
  const pollProgress = useCallback(async () => {
    if (!workspaceId || !lakehouseId) return;

    try {
      const progress = await fabricService.readPipelineProgress(workspaceId, lakehouseId);
      if (!progress) return;

      // Log new completions
      const completedCount = progress.completed?.length || 0;
      if (completedCount > lastLoggedCompleted.current) {
        const newlyCompleted = progress.completed.slice(lastLoggedCompleted.current);
        for (const stepId of newlyCompleted) {
          const step = TRANSLATION_PIPELINE.find(s => s.id === stepId);
          const stepTime = progress.step_times[stepId];
          const duration = stepTime?.duration_sec ? ` (${stepTime.duration_sec}s)` : '';
          addLog(`✓ ${stepId}: ${step?.name || stepId} completed${duration}`);
        }
        lastLoggedCompleted.current = completedCount;
      }

      // Log current step change
      if (progress.current && progress.current !== lastLoggedStep.current) {
        const step = TRANSLATION_PIPELINE.find(s => s.id === progress.current);
        addLog(`▶ ${progress.current}: ${step?.name || progress.current} running...`);
        lastLoggedStep.current = progress.current;
      }

      // Update step states from progress file
      for (const step of TRANSLATION_PIPELINE) {
        const stepTime = progress.step_times[step.id];
        if (stepTime) {
          const startTime = new Date(stepTime.start).getTime();
          const endTime = stepTime.end ? new Date(stepTime.end).getTime() : undefined;
          
          if (progress.completed.includes(step.id)) {
            updateStepState(step.id, { 
              status: 'completed', 
              startTime, 
              endTime 
            });
          } else if (stepTime.error) {
            updateStepState(step.id, { 
              status: 'failed', 
              startTime, 
              endTime,
              error: stepTime.error 
            });
          }
        }
        
        if (progress.current === step.id) {
          const stepTime = progress.step_times[step.id];
          const startTime = stepTime ? new Date(stepTime.start).getTime() : Date.now();
          updateStepState(step.id, { status: 'running', startTime });
        }
      }

      // Check if pipeline completed or failed
      if (progress.status === 'completed') {
        setPipelineStatus('completed');
        addLog('✓ Translation pipeline completed successfully!');
        stopPolling();
        lastLoggedStep.current = null;
        lastLoggedCompleted.current = 0;
        if (onComplete) onComplete();
      } else if (progress.status === 'failed') {
        setPipelineStatus('failed', progress.error || 'Pipeline failed');
        addLog(`✗ Pipeline failed: ${progress.error || 'Unknown error'}`);
        stopPolling();
        lastLoggedStep.current = null;
        lastLoggedCompleted.current = 0;
      }
    } catch (error) {
      // Progress file may not exist yet, ignore errors during polling
      console.log('Polling progress:', error);
    }
  }, [workspaceId, lakehouseId, fabricService, updateStepState, setPipelineStatus, addLog, onComplete]);

  // Start polling for progress
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return; // Already polling
    addLog(`📡 Starting progress polling every ${POLL_INTERVAL_MS / 1000}s...`);
    pollIntervalRef.current = setInterval(pollProgress, POLL_INTERVAL_MS);
  }, [pollProgress, addLog]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      addLog('📡 Stopped progress polling');
    }
  }, [addLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Check status manually (for resuming after browser reopen)
  const checkStatus = async () => {
    addLog('🔍 Checking pipeline status...');
    await pollProgress();
  };

  // Reset pipeline state (both local and Fabric)
  const resetPipeline = async () => {
    addLog('🔄 Resetting pipeline state...');
    stopPolling();
    
    // Try to clear the progress file in Fabric
    if (workspaceId && lakehouseId) {
      try {
        const cleared = await fabricService.clearPipelineProgress(workspaceId, lakehouseId);
        if (cleared) {
          addLog('✓ Cleared progress file from Fabric');
        } else {
          addLog('ℹ️ No progress file found in Fabric');
        }
      } catch (error) {
        addLog(`⚠️ Could not clear Fabric progress file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Clear local state
    clearPipelineExecution();
    addLog('✓ Local pipeline state cleared');
    addLog('Ready to run a new translation.');
  };

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
    
    // Reset tracking refs for new run
    lastLoggedStep.current = null;
    lastLoggedCompleted.current = 0;
    
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

      // Step 3: Start the orchestrator notebook (runs all steps server-side)
      addLog('🚀 Starting orchestrator notebook (server-side execution)...');
      addLog('  Pipeline will continue running even if you close this browser.');
      
      try {
        const orchestratorJobId = await fabricService.runOrchestrator(workspaceId);
        addLog(`✓ Orchestrator started: ${orchestratorJobId}`);
        addLog('  Polling progress every 10 seconds...');
        
        // Start polling for progress updates
        startPolling();
        
        // Do an immediate poll
        await pollProgress();
        
      } catch (orchestratorError) {
        const errorMsg = orchestratorError instanceof Error ? orchestratorError.message : 'Failed to start orchestrator';
        setPipelineStatus('failed', errorMsg);
        addLog(`✗ Failed to start orchestrator: ${errorMsg}`);
        throw orchestratorError;
      }
      // Note: onComplete is called by pollProgress when pipeline finishes
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
        <div style={{ display: 'flex', gap: '8px' }}>
          {isRunning && (
            <Button
              appearance="outline"
              icon={<ArrowClockwise24Regular />}
              onClick={checkStatus}
            >
              Check Status
            </Button>
          )}
          <Button
            appearance="primary"
            icon={isRunning ? <Spinner size="tiny" /> : <Play24Regular />}
            onClick={runPipeline}
            disabled={isRunning}
          >
            {isRunning ? 'Running...' : 'Run Translation'}
          </Button>
        </div>
      </div>

      {isRunning && (
        <MessageBar intent="info">
          <MessageBarBody>
            <MessageBarTitle>Server-Side Execution</MessageBarTitle>
            The pipeline is running on the Fabric server. You can close this tab and check back later.
            Use "Check Status" to refresh progress.
          </MessageBarBody>
        </MessageBar>
      )}

      {errorMessage && (
        <MessageBar intent="error">
          <MessageBarBody>
            <MessageBarTitle>Error</MessageBarTitle>
            {errorMessage}
            <Button 
              appearance="subtle" 
              size="small" 
              style={{ marginLeft: '8px' }}
              onClick={() => clearPipelineExecution()}
            >
              Clear &amp; Retry
            </Button>
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

      {isStale && (
        <MessageBar intent="warning">
          <MessageBarBody>
            <MessageBarTitle>Pipeline Status Unknown</MessageBarTitle>
            The pipeline was running but tracking was interrupted (browser refreshed or navigated away). 
            Check the Fabric Portal for actual job status.
            <Button 
              appearance="subtle" 
              size="small" 
              style={{ marginLeft: '8px' }}
              onClick={() => clearPipelineExecution()}
            >
              Clear &amp; Start Fresh
            </Button>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Body2 style={{ fontWeight: 600 }}>Execution Log</Body2>
            <Button
              appearance="subtle"
              size="small"
              icon={<Stop24Regular />}
              onClick={resetPipeline}
              title="Clear pipeline state and logs"
            >
              Reset
            </Button>
          </div>
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
