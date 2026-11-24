import React, { useEffect, useState } from 'react';
import { Search, Database, FileText, BarChart3, RefreshCw } from 'lucide-react';
import { apiRequest } from '../api';

interface KnowledgeStats {
  totalDocuments: number;
  totalChunks: number;
  vectorDimensions: number;
  lastUpdated: string | null;
}

interface SearchResult {
  content: string;
  source: string;
  page: number | null;
  similarity: number;
}

export function KnowledgeBase() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isReindexing, setIsReindexing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<KnowledgeStats>({
    totalDocuments: 0,
    totalChunks: 0,
    vectorDimensions: 0,
    lastUpdated: null,
  });

  const loadStats = async () => {
    try {
      const data = await apiRequest<KnowledgeStats>('/api/knowledge');
      setStats(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load knowledge base.');
    }
  };

  useEffect(() => { loadStats(); }, []);

  const handleReindex = async () => {
    setIsReindexing(true);
    setError('');
    try {
      await apiRequest('/api/reindex', { method: 'POST' });
      await loadStats();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Reindex failed.');
    } finally {
      setIsReindexing(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setError('');
    try {
      const data = await apiRequest<{ results: SearchResult[] }>('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, k: 10 }),
      });
      setResults(data.results);
    } catch (requestError) {
      setResults([]);
      setError(requestError instanceof Error ? requestError.message : 'Search failed.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleExport = () => {
    window.open('http://localhost:5000/api/export', '_blank');
  };

  const lastUpdated = stats.lastUpdated ? new Date(stats.lastUpdated) : null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Knowledge Base</h1>
        <p className="text-gray-600">Explore and manage your vector database and knowledge chunks</p>
      </div>

      {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Total Documents', value: stats.totalDocuments, icon: FileText, color: 'text-blue-600' },
          { label: 'Knowledge Chunks', value: stats.totalChunks.toLocaleString(), icon: Database, color: 'text-green-600' },
          { label: 'Vector Dimensions', value: stats.vectorDimensions, icon: BarChart3, color: 'text-purple-600' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-gray-600">{item.label}</p><p className="text-2xl font-bold text-gray-900">{item.value}</p></div>
              <item.icon className={`w-8 h-8 ${item.color}`} />
            </div>
          </div>
        ))}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Last Updated</p>
              <p className="text-sm font-bold text-gray-900">{lastUpdated ? lastUpdated.toLocaleDateString() : 'Never'}</p>
              {lastUpdated && <p className="text-xs text-gray-500">{lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
            </div>
            <RefreshCw className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Knowledge Base Actions</h3>
        <div className="flex flex-wrap gap-4">
          <button onClick={handleReindex} disabled={isReindexing} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 mr-2 ${isReindexing ? 'animate-spin' : ''}`} />
            {isReindexing ? 'Reindexing...' : 'Reindex Knowledge Base'}
          </button>
          <button onClick={handleExport} className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            <Database className="w-4 h-4 mr-2" />Export Vector Database
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Semantic Search</h3>
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input type="text" placeholder="Search knowledge chunks by semantic similarity..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleSearch()} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={handleSearch} disabled={isSearching} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{isSearching ? 'Searching...' : 'Search'}</button>
        </div>
        <div className="space-y-4">
          {results.map((chunk, index) => (
            <div key={`${chunk.source}-${index}`} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm text-gray-800 mb-2">{chunk.content}</p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>Source: {chunk.source}</span>{chunk.page && <span>Page: {chunk.page}</span>}
                  </div>
                </div>
                <div className="ml-4 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">{Math.round(chunk.similarity * 100)}% match</div>
              </div>
            </div>
          ))}
          {!results.length && searchQuery && !isSearching && <p className="text-sm text-gray-500">No matching knowledge chunks found.</p>}
        </div>
      </div>
    </div>
  );
}
