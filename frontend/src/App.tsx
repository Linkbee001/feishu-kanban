/**
 * App component - Main entry point for Admin Dashboard
 * Supports routing between Dashboard and Group Config pages
 */

import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { GroupConfigPage } from './components/GroupConfigPage';

export function App() {
  const [currentPage, setCurrentPage] = useState<'instances' | 'group-config'>('instances');

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/admin/group-config') {
      setCurrentPage('group-config');
    } else {
      setCurrentPage('instances');
    }
  }, []);

  return (
    <Layout>
      {currentPage === 'instances' ? <Dashboard /> : <GroupConfigPage />}
    </Layout>
  );
}
