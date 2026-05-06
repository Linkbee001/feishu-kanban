import { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { InstanceDetail } from './components/InstanceDetail';

export function App() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Pass selection handler to Layout/Sidebar
  return (
    <Layout onSelectInstance={setSelectedChatId}>
      {selectedChatId ? (
        <InstanceDetail chatId={selectedChatId} />
      ) : (
        <Dashboard />
      )}
    </Layout>
  );
}