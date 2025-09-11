import React, { useState } from 'react';
import { Search, Database, FileText, BarChart3, RefreshCw } from 'lucide-react';

interface KnowledgeStats {
  totalDocuments: number;
  totalChunks: number;
  vectorDimensions: number;
  lastUpdated: Date;
}

export function KnowledgeBase() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isReindexing, setIsReindexing] = useState(false);
  
  const stats: KnowledgeStats = {
    totalDocuments: 45,
    totalChunks: 2847,
    vectorDimensions: 1536,
    lastUpdated: new Date('2024-01-15T14:30:00')
  };

  const handleReindex = async () => {
    setIsReindexing(true);
    // Simulate reindexing process
    await new Promise(resolve => setTimeout(resolve, 3000));
    setIsReindexing(false);
  };

  const sampleChunks = [
    {
      id: '1',
      content: 'Our company policy regarding remote work allows employees to work from home up to 3 days per week, subject to manager approval and role requirements.',
      source: 'Company Handbook 2024.pdf',
      page: 15,
      similarity: 0.95
    },
    {
      id: '2',
      content: 'The new product feature includes advanced analytics dashboard with real-time reporting capabilities and customizable widgets.',
      source: 'Product Documentation.docx',
      page: 23,
      similarity: 0.87
    },
    {
      id: '3',
      content: 'Technical requirements specify minimum RAM of 8GB, SSD storage, and support for Docker containerization.',
      source: 'Technical Specifications.txt',
      page: 1,
      similarity: 0.82
    }
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Knowledge Base</h1>
        <p className="text-gray-600">Explore and manage your vector database and knowledge chunks</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Documents</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalDocuments}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Knowledge Chunks</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalChunks.toLocaleString()}</p>
            </div>
            <Database className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Vector Dimensions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.vectorDimensions}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Last Updated</p>
              <p className="text-sm font-bold text-gray-900">
                {stats.lastUpdated.toLocaleDateString()}
              </p>
              <p className="text-xs text-gray-500">
                {stats.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <RefreshCw className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Knowledge Base Actions</h3>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleReindex}
            disabled={isReindexing}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isReindexing ? 'animate-spin' : ''}`} />
            {isReindexing ? 'Reindexing...' : 'Reindex Knowledge Base'}
          </button>
          
          <button className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <Database className="w-4 h-4 mr-2" />
            Export Vector Database
          </button>
          
          <button className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
            <BarChart3 className="w-4 h-4 mr-2" />
            View Analytics
          </button>
        </div>
      </div>

      {/* Search Interface */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Semantic Search</h3>
        <div className="relative mb-4">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search knowledge chunks by semantic similarity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        {/* Sample Results */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-600">Sample Knowledge Chunks</h4>
          {sampleChunks.map((chunk) => (
            <div key={chunk.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm text-gray-800 mb-2">{chunk.content}</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>Source: {chunk.source}</span>
                    <span>Page: {chunk.page}</span>
                  </div>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <div className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                    {Math.round(chunk.similarity * 100)}% match
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}