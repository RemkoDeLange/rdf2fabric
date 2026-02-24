import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import {
  makeStyles,
  tokens,
  Button,
  Avatar,
  Menu,
  MenuTrigger,
  MenuList,
  MenuItem,
  MenuPopover,
  Tooltip,
} from '@fluentui/react-components';
import {
  Home24Regular,
  Settings24Regular,
  SignOut24Regular,
  Person24Regular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    boxShadow: tokens.shadow4,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '18px',
    fontWeight: 600,
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '8px 12px',
    borderRadius: tokens.borderRadiusMedium,
    textDecoration: 'none',
    color: tokens.colorNeutralForegroundOnBrand,
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    '&.active': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  main: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
  },
});

export function Layout() {
  const styles = useStyles();
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();

  const user = accounts[0];

  const handleLogout = () => {
    instance.logoutRedirect();
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="8" r="2" />
            <circle cx="8" cy="14" r="2" />
            <circle cx="16" cy="14" r="2" />
            <line x1="12" y1="10" x2="8" y2="12" stroke="currentColor" strokeWidth="1.5" />
            <line x1="12" y1="10" x2="16" y2="12" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          RDF2Fabric
        </div>

        <nav className={styles.nav}>
          <Tooltip content="Home" relationship="label">
            <NavLink to="/" className={styles.navLink}>
              <Home24Regular />
              Projects
            </NavLink>
          </Tooltip>
          <Tooltip content="Settings" relationship="label">
            <NavLink to="/settings" className={styles.navLink}>
              <Settings24Regular />
              Settings
            </NavLink>
          </Tooltip>
        </nav>

        <div className={styles.userSection}>
          {isAuthenticated && user ? (
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button
                  appearance="transparent"
                  icon={
                    <Avatar
                      name={user.name || user.username}
                      size={28}
                      color="colorful"
                    />
                  }
                  style={{ color: 'white' }}
                >
                  {user.name || user.username}
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem icon={<Person24Regular />}>
                    {user.username}
                  </MenuItem>
                  <MenuItem icon={<SignOut24Regular />} onClick={handleLogout}>
                    Sign out
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          ) : (
            <Button
              appearance="transparent"
              onClick={() => navigate('/login')}
              style={{ color: 'white' }}
            >
              Sign in
            </Button>
          )}
        </div>
      </header>

      <main className={styles.main} role="main">
        <Outlet />
      </main>
    </div>
  );
}
