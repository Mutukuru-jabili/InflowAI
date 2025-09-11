import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { DocumentManager } from './components/DocumentManager';
import { KnowledgeBase } from './components/KnowledgeBase';
import { Settings } from './components/Settings';
import { Header } from './components/Header';

export type ViewType = 'chat' | 'documents' | 'knowledge' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar 
        currentView={currentView}
        onViewChange={setCurrentView}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          currentView={currentView}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        
        <main className="flex-1 overflow-hidden">
          {currentView === 'chat' && <ChatInterface />}
          {currentView === 'documents' && <DocumentManager />}
          {currentView === 'knowledge' && <KnowledgeBase />}
          {currentView === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}

export default App;