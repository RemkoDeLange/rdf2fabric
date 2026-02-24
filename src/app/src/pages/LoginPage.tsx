import { useMsal } from '@azure/msal-react';
import {
  makeStyles,
  tokens,
  Card,
  CardHeader,
  Button,
  Title1,
  Body1,
} from '@fluentui/react-components';
import { PersonKey24Regular } from '@fluentui/react-icons';
import { loginRequest } from '../config/authConfig';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  card: {
    width: '400px',
    padding: '32px',
    textAlign: 'center',
  },
  logo: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px',
  },
  title: {
    marginBottom: '16px',
  },
  description: {
    marginBottom: '32px',
    color: tokens.colorNeutralForeground2,
  },
  button: {
    width: '100%',
  },
});

export function LoginPage() {
  const styles = useStyles();
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginRedirect(loginRequest);
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <div className={styles.logo}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill={tokens.colorBrandForeground1}>
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="8" r="2.5" />
            <circle cx="7" cy="15" r="2.5" />
            <circle cx="17" cy="15" r="2.5" />
            <line x1="12" y1="10.5" x2="7" y2="12.5" stroke="currentColor" strokeWidth="1.5" />
            <line x1="12" y1="10.5" x2="17" y2="12.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>

        <CardHeader
          header={<Title1 className={styles.title}>RDF2Fabric</Title1>}
          description={
            <Body1 className={styles.description}>
              Sign in with your Microsoft account to translate RDF data to Fabric Graph.
            </Body1>
          }
        />

        <Button
          appearance="primary"
          size="large"
          icon={<PersonKey24Regular />}
          onClick={handleLogin}
          className={styles.button}
        >
          Sign in with Microsoft
        </Button>
      </Card>
    </div>
  );
}
