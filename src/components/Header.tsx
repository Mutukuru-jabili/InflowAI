import React from 'react';
import { Menu, Bot, Sparkles } from 'lucide-react';
import { ViewType } from '../App';

interface HeaderProps {
  currentView: ViewType;
  onToggleSidebar: () => void;
}

export function Header({ currentView, onToggleSidebar }: HeaderProps) {
  const getViewTitle = () => {
    switch (currentView) {
      case 'chat': return 'AI Assistant';
      case 'documents': return 'Document Management';
      case 'knowledge': return 'Knowledge Base';
      case 'settings': return 'Settings';
      default: return 'InfoFlow AI';
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Bot className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">InfoFlow AI</h1>
                <p className="text-sm text-gray-500">{getViewTitle()}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-1.5 rounded-full border border-blue-100">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">RAG Powered</span>
          </div>
          
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-semibold">AI</span>
          </div>
        </div>
      </div>
    </header>
  );
}