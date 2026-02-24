import { useNavigate } from 'react-router-dom';
import {
  makeStyles,
  tokens,
  Card,
  CardHeader,
  CardPreview,
  Button,
  Title2,
  Body1,
  Caption1,
  Badge,
} from '@fluentui/react-components';
import {
  Add24Regular,
  Document24Regular,
  ArrowRight24Regular,
} from '@fluentui/react-icons';
import { useAppStore, Project } from '../stores/appStore';

const useStyles = makeStyles({
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px',
  },
  card: {
    cursor: 'pointer',
    transition: 'box-shadow 0.2s, transform 0.2s',
    '&:hover': {
      boxShadow: tokens.shadow8,
      transform: 'translateY(-2px)',
    },
  },
  cardPreview: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '80px',
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
  },
  emptyState: {
    textAlign: 'center',
    padding: '64px',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px dashed ${tokens.colorNeutralStroke1}`,
  },
  statusBadge: {
    marginTop: '8px',
  },
});

const statusColors: Record<Project['status'], 'informative' | 'warning' | 'success' | 'brand'> = {
  draft: 'informative',
  configured: 'warning',
  translated: 'brand',
  loaded: 'success',
};

export function HomePage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const { projects, addProject, setCurrentProject } = useAppStore();

  const handleCreateProject = () => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: `Project ${projects.length + 1}`,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      source: {
        files: [],
        schemaFiles: [],
      },
      schemaLevel: null,
      decisions: {},
      status: 'draft',
    };

    addProject(newProject);
    setCurrentProject(newProject.id);
    navigate(`/project/${newProject.id}`);
  };

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project.id);
    navigate(`/project/${project.id}`);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title2>Projects</Title2>
        <Button
          appearance="primary"
          icon={<Add24Regular />}
          onClick={handleCreateProject}
        >
          New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className={styles.emptyState}>
          <Document24Regular style={{ fontSize: '48px', marginBottom: '16px' }} />
          <Title2>No projects yet</Title2>
          <Body1>Create a new project to start translating RDF data to Fabric Graph.</Body1>
          <Button
            appearance="primary"
            icon={<Add24Regular />}
            onClick={handleCreateProject}
            style={{ marginTop: '24px' }}
          >
            Create your first project
          </Button>
        </div>
      ) : (
        <div className={styles.grid}>
          {projects.map((project) => (
            <Card
              key={project.id}
              className={styles.card}
              onClick={() => handleOpenProject(project)}
            >
              <CardPreview className={styles.cardPreview}>
                <Document24Regular style={{ fontSize: '32px' }} />
              </CardPreview>
              <CardHeader
                header={<Title2>{project.name}</Title2>}
                description={
                  <>
                    <Caption1>
                      {project.source.files.length} files selected
                    </Caption1>
                    <div className={styles.statusBadge}>
                      <Badge
                        appearance="filled"
                        color={statusColors[project.status]}
                      >
                        {project.status}
                      </Badge>
                    </div>
                  </>
                }
                action={
                  <Button
                    appearance="transparent"
                    icon={<ArrowRight24Regular />}
                    aria-label="Open project"
                  />
                }
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
