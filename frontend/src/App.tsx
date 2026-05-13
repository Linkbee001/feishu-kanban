import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { AppShell } from './features/layout/app-shell';

// Pages
import { DashboardPage } from './features/dashboard/page';
import { GroupsPage } from './features/groups/page';
import { MessagesPage } from './features/messages/page';
import { RunsPage } from './features/runs/page';
import { SettingsPage } from './features/settings/page';
import { AgentTestingPage } from './features/agent-testing/page';
import { GroupConfigPage } from './components/GroupConfigPage';

const router = createBrowserRouter([
  {
    path: '/admin',
    element: <AppShell />,
    children: [
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'groups', element: <GroupsPage /> },
      { path: 'group-config', element: <GroupConfigPage /> },
      { path: 'messages', element: <MessagesPage /> },
      { path: 'runs', element: <RunsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'agent-testing', element: <AgentTestingPage /> },
      { index: true, element: <Navigate to="dashboard" replace /> },
    ],
  },
  { path: '/', element: <Navigate to="/admin/dashboard" replace /> },
  {
    path: '*',
    element: (
      <div className="min-h-svh flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">404</h1>
          <p className="text-muted-foreground mb-6">Page not found</p>
          <a
            href="/admin/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    ),
  },
]);

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}
