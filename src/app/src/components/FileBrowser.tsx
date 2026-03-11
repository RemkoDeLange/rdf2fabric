import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import {
  makeStyles,
  tokens,
  Card,
  Title3,
  Body1,
  Button,
  Spinner,
  Checkbox,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbButton,
  BreadcrumbDivider,
  MessageBar,
  MessageBarBody,
} from '@fluentui/react-components';
import {
  Folder24Regular,
  Document24Regular,
  ArrowUp24Regular,
  ArrowSync24Regular,
} from '@fluentui/react-icons';
import { FabricService, OneLakeFile } from '../services/fabricService';
import { useAppStore } from '../stores/appStore';

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
  toolbar: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '400px',
    overflowY: 'auto',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: '8px',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  fileItemSelected: {
    backgroundColor: tokens.colorBrandBackground2,
  },
  fileName: {
    flex: 1,
  },
  fileSize: {
    color: tokens.colorNeutralForeground3,
    fontSize: '12px',
  },
  emptyState: {
    padding: '32px',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
  },
  selectedInfo: {
    padding: '12px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
});

interface FileBrowserProps {
  onSelectionChange?: (files: string[]) => void;
  filter?: (file: OneLakeFile) => boolean;
  multiSelect?: boolean;
}

export function FileBrowser({ onSelectionChange, filter, multiSelect = true }: FileBrowserProps) {
  const styles = useStyles();
  const { instance } = useMsal();
  const { workspaceId, lakehouseId } = useAppStore();

  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<OneLakeFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fabricService = new FabricService(instance);

  // Parse path into breadcrumb segments
  const pathSegments = currentPath ? currentPath.split('/').filter(Boolean) : [];

  useEffect(() => {
    if (workspaceId && lakehouseId) {
      loadFiles();
    }
  }, [workspaceId, lakehouseId, currentPath]);

  const loadFiles = async () => {
    if (!workspaceId || !lakehouseId) return;

    setIsLoading(true);
    setError(null);

    try {
      const fileList = await fabricService.listOneLakeFiles(workspaceId, lakehouseId, currentPath);
      
      // Apply filter if provided
      const filteredFiles = filter ? fileList.filter(filter) : fileList;
      
      // Sort: directories first, then by name
      filteredFiles.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      setFiles(filteredFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (file: OneLakeFile) => {
    if (file.isDirectory) {
      const newPath = currentPath ? `${currentPath}/${file.name}` : file.name;
      setCurrentPath(newPath);
      setSelectedFiles(new Set()); // Clear selection on navigate
    }
  };

  const handleNavigateUp = () => {
    const segments = currentPath.split('/').filter(Boolean);
    segments.pop();
    setCurrentPath(segments.join('/'));
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setCurrentPath('');
    } else {
      const newPath = pathSegments.slice(0, index + 1).join('/');
      setCurrentPath(newPath);
    }
  };

  const handleSelectFile = (file: OneLakeFile, checked: boolean) => {
    if (file.isDirectory) return;

    const fullPath = currentPath ? `${currentPath}/${file.name}` : file.name;
    const newSelection = new Set(selectedFiles);

    if (multiSelect) {
      if (checked) {
        newSelection.add(fullPath);
      } else {
        newSelection.delete(fullPath);
      }
    } else {
      newSelection.clear();
      if (checked) {
        newSelection.add(fullPath);
      }
    }

    setSelectedFiles(newSelection);
    onSelectionChange?.(Array.from(newSelection));
  };

  const isFileSelected = (file: OneLakeFile): boolean => {
    const fullPath = currentPath ? `${currentPath}/${file.name}` : file.name;
    return selectedFiles.has(fullPath);
  };

  const formatSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!workspaceId || !lakehouseId) {
    return (
      <Card>
        <MessageBar intent="warning">
          <MessageBarBody>
            Please configure your workspace connection in Settings first.
          </MessageBarBody>
        </MessageBar>
      </Card>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title3>OneLake Files</Title3>
        <div className={styles.toolbar}>
          <Button
            icon={<ArrowUp24Regular />}
            disabled={!currentPath || isLoading}
            onClick={handleNavigateUp}
          >
            Up
          </Button>
          <Button
            icon={isLoading ? <Spinner size="tiny" /> : <ArrowSync24Regular />}
            onClick={loadFiles}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>
      </div>

      <Breadcrumb>
        <BreadcrumbItem>
          <BreadcrumbButton onClick={() => handleBreadcrumbClick(-1)}>
            Files
          </BreadcrumbButton>
        </BreadcrumbItem>
        {pathSegments.map((segment, index) => (
          <span key={index}>
            <BreadcrumbDivider />
            <BreadcrumbItem>
              <BreadcrumbButton onClick={() => handleBreadcrumbClick(index)}>
                {segment}
              </BreadcrumbButton>
            </BreadcrumbItem>
          </span>
        ))}
      </Breadcrumb>

      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <div className={styles.fileList}>
        {isLoading && files.length === 0 ? (
          <div className={styles.emptyState}>
            <Spinner label="Loading files..." />
          </div>
        ) : files.length === 0 ? (
          <div className={styles.emptyState}>
            <Body1>No files found in this folder</Body1>
          </div>
        ) : (
          files.map((file) => (
            <div
              key={file.name}
              className={`${styles.fileItem} ${isFileSelected(file) ? styles.fileItemSelected : ''}`}
              onClick={() => file.isDirectory && handleNavigate(file)}
              onDoubleClick={() => handleNavigate(file)}
            >
              {!file.isDirectory && (
                <Checkbox
                  checked={isFileSelected(file)}
                  onChange={(_, data) => handleSelectFile(file, data.checked as boolean)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              {file.isDirectory ? (
                <Folder24Regular primaryFill={tokens.colorBrandForeground1} />
              ) : (
                <Document24Regular />
              )}
              <span className={styles.fileName}>{file.name}</span>
              {!file.isDirectory && (
                <span className={styles.fileSize}>{formatSize(file.size)}</span>
              )}
            </div>
          ))
        )}
      </div>

      {selectedFiles.size > 0 && (
        <div className={styles.selectedInfo}>
          <Body1>
            <strong>{selectedFiles.size}</strong> file{selectedFiles.size > 1 ? 's' : ''} selected
          </Body1>
        </div>
      )}
    </div>
  );
}

// Helper filter for RDF files
export const rdfFileFilter = (file: OneLakeFile): boolean => {
  if (file.isDirectory) return true;
  const ext = file.name.toLowerCase().split('.').pop();
  return ['ttl', 'rdf', 'owl', 'nt', 'n3', 'jsonld', 'trig', 'nq'].includes(ext || '');
};
