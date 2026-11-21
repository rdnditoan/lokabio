import { useEffect, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { AdminPage } from './pages/AdminPage';
import { PublicProfilePage } from './pages/PublicProfilePage';

function AppRouter() {
  const [pathname, setPathname] = useState<string>(
    () => window.location.pathname || '/'
  );

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string) => {
    const normalized = to.startsWith('/') ? to : `/${to}`;
    const [nextPath] = normalized.split('?');
    const currentFull = window.location.pathname + window.location.search;
    if (normalized === currentFull) return;
    window.history.pushState({}, '', normalized);
    setPathname(nextPath || '/');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const cleanPath = pathname.replace(/\/+$/, '') || '/';

  if (cleanPath === '/') {
    return <LandingPage onNavigate={navigate} />;
  }

  if (cleanPath === '/login' || cleanPath === '/masuk') {
    return <AuthPage initialMode="login" onNavigate={navigate} />;
  }

  if (cleanPath === '/register' || cleanPath === '/daftar') {
    return <AuthPage initialMode="register" onNavigate={navigate} />;
  }

  if (cleanPath === '/dashboard') {
    return <DashboardPage onNavigate={navigate} />;
  }

  if (cleanPath === '/admin') {
    return <AdminPage onNavigate={navigate} />;
  }

  const username = cleanPath.replace(/^\/+/, '').split('/')[0] || '';
  return <PublicProfilePage username={username} onNavigate={navigate} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
