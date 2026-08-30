import React, { useState } from 'react';
import { AppProvider, useApp } from './state/AppContext';
import { TopBar, Tab } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';
import { Toasts } from './components/Toasts';
import { InvestigatePage } from './pages/InvestigatePage';
import { ExplorerPage } from './pages/ExplorerPage';
import { ResultsPage } from './pages/ResultsPage';

const Shell: React.FC = () => {
  const [tab, setTab] = useState<Tab>('investigate');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { focusLocation } = useApp();

  return (
    <div>
      <TopBar tab={tab} onTab={setTab} onSettings={() => setSettingsOpen(true)} />
      <div className="shell">
        <Sidebar />
        <main className="content">
          {tab === 'investigate' && <InvestigatePage onRun={() => setTab('results')} />}
          {tab === 'explorer' && <ExplorerPage />}
          {tab === 'results' && (
            <ResultsPage
              onFocusLocation={(lat, lon) => {
                setTab('explorer');
                focusLocation({ lat, lon, label: 'Selected result', source: 'MANUAL' });
              }}
            />
          )}
        </main>
      </div>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Toasts />
    </div>
  );
};

export const App: React.FC = () => (
  <AppProvider>
    <Shell />
  </AppProvider>
);
