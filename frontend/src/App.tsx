/**
 * App component - Main entry point for Admin Dashboard
 * React Router v7 configuration with nested routes
 */

import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { Layout } from './components/layout';
import {
  DashboardPage,
  GroupsPage,
  MessagesPage,
  RunsPage,
  SettingsPage,
} from './pages';

const router = createBrowserRouter([
  {
    path: '/admin',
    element: <Layout />,
    children: [
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'groups', element: <GroupsPage /> },
      { path: 'messages', element: <MessagesPage /> },
      { path: 'runs', element: <RunsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { index: true, element: <Navigate to="dashboard" replace /> },
    ],
  },
  { path: '/', element: <Navigate to="/admin/dashboard" replace /> },
  {
    path: '*',
    element: (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fbf7f1] to-[#f5efe6]">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-ink mb-4">404</h1>
          <p className="text-muted mb-6">页面未找到</p>
          <a
            href="/admin/dashboard"
            className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
          >
            返回 Dashboard
          </a>
        </div>
      </div>
    ),
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
