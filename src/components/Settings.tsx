import React, { useEffect, useState } from 'react';
import { Save, Key, Database, Brain, Server } from 'lucide-react';
import { apiRequest } from '../api';

interface SettingsConfig {
  provider: 'ollama' | 'openai';
  openaiApiKey: string;
  openaiApiKeySet: boolean;
  model: string;
  ollamaBaseUrl: string;
  maxTokens: number;
  temperature: number;
  chunkSize: number;
  chunkOverlap: number;
  vectorDatabase: string;
  embeddingModel: string;
}

export function Settings() {
  const [config, setConfig] = useState<SettingsConfig>({
    provider: 'ollama',
    openaiApiKey: '',
    openaiApiKeySet: false,
    model: 'qwen2.5:3b',
    ollamaBaseUrl: 'http://localhost:11434',
    maxTokens: 2000,
    temperature: 0.7,
    chunkSize: 1000,
    chunkOverlap: 200,
    vectorDatabase: 'faiss',
    embeddingModel: 'text-embedding-ada-002',
  });
  const [status, setStatus] = useState({
    apiConnected: false,
    apiDetail: 'Checking...',
    vectorActive: false,
    processingReady: true,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const loadSettings = async () => {
    try {
      const data = await apiRequest<{
        config: Omit<SettingsConfig, 'openaiApiKey'>;
        status: typeof status;
      }>('/api/settings');
      setConfig({ ...data.config, openaiApiKey: '' });
      setStatus(data.status);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load settings.');
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const handleSave = async () => {
    setError('');
    try {
      await apiRequest('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openaiApiKey: config.openaiApiKey,
          provider: config.provider,
          model: config.model,
          ollamaBaseUrl: config.ollamaBaseUrl,
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          chunkSize: config.chunkSize,
          chunkOverlap: config.chunkOverlap,
          vectorDatabase: config.vectorDatabase,
          embeddingModel: config.embeddingModel,
        }),
      });
      setSaved(true);
      await loadSettings();
      setTimeout(() => setSaved(false), 2000);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save settings.');
    }
  };

  const handleInputChange = (key: keyof SettingsConfig, value: string | number) => {
    setConfig(previous => ({ ...previous, [key]: value }));
  };

  const handleProviderChange = (provider: 'ollama' | 'openai') => {
    setConfig(previous => ({
      ...previous,
      provider,
      model: provider === 'ollama' ? 'qwen2.5:3b' : 'gpt-4',
      embeddingModel: provider === 'ollama' ? 'nomic-embed-text' : 'text-embedding-ada-002',
    }));
  };

  const statusCard = (label: string, detail: string, connected: boolean, color: string) => (
    <div className={`text-center p-4 rounded-lg border ${connected ? color : 'bg-red-50 border-red-200'}`}>
      <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      <p className="text-sm font-medium text-gray-800">{label}</p>
      <p className="text-xs text-gray-600">{detail}</p>
    </div>
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8"><h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1><p className="text-gray-600">Configure your InfoFlow AI system parameters</p></div>
      {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="space-y-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6"><Key className="w-6 h-6 text-blue-600" /><h3 className="text-lg font-semibold">AI Provider</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
              <select value={config.provider} onChange={(event) => handleProviderChange(event.target.value as 'ollama' | 'openai')} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="ollama">Ollama (local/free)</option><option value="openai">OpenAI API</option>
              </select>
            </div>
            {config.provider === 'openai' && <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">API Key {config.openaiApiKeySet ? '(configured)' : '(not configured)'}</label>
              <input type="password" value={config.openaiApiKey} onChange={(event) => handleInputChange('openaiApiKey', event.target.value)} placeholder={config.openaiApiKeySet ? 'Leave blank to keep current key' : 'sk-...'} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{config.provider === 'ollama' ? 'Ollama Chat Model' : 'OpenAI Model'}</label>
              {config.provider === 'ollama' ? (
                <>
                  <input value={config.model} onChange={(event) => handleInputChange('model', event.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  <p className="mt-1 text-xs text-gray-500">Install a model with: <code>ollama pull {config.model || 'qwen2.5:3b'}</code></p>
                </>
              ) : (
                <select value={config.model} onChange={(event) => handleInputChange('model', event.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="gpt-4">GPT-4</option><option value="gpt-4-turbo">GPT-4 Turbo</option><option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              )}
            </div>
            {config.provider === 'ollama' && <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ollama URL</label>
              <input value={config.ollamaBaseUrl} onChange={(event) => handleInputChange('ollamaBaseUrl', event.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>}
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Max Tokens: {config.maxTokens}</label><input type="range" min="100" max="4000" step="100" value={config.maxTokens} onChange={(event) => handleInputChange('maxTokens', parseInt(event.target.value))} className="w-full" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Temperature: {config.temperature}</label><input type="range" min="0" max="1" step="0.1" value={config.temperature} onChange={(event) => handleInputChange('temperature', parseFloat(event.target.value))} className="w-full" /></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6"><Brain className="w-6 h-6 text-green-600" /><h3 className="text-lg font-semibold">Document Processing</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Chunk Size: {config.chunkSize} characters</label><input type="range" min="500" max="2000" step="100" value={config.chunkSize} onChange={(event) => handleInputChange('chunkSize', parseInt(event.target.value))} className="w-full" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Chunk Overlap: {config.chunkOverlap} characters</label><input type="range" min="50" max="500" step="50" value={config.chunkOverlap} onChange={(event) => handleInputChange('chunkOverlap', parseInt(event.target.value))} className="w-full" /></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6"><Database className="w-6 h-6 text-purple-600" /><h3 className="text-lg font-semibold">Vector Database</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Vector Database</label><select value={config.vectorDatabase} onChange={(event) => handleInputChange('vectorDatabase', event.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg"><option value="faiss">FAISS</option></select></div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Embedding Model</label>
              {config.provider === 'ollama' ? (
                <input value={config.embeddingModel} onChange={(event) => handleInputChange('embeddingModel', event.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              ) : (
                <select value={config.embeddingModel} onChange={(event) => handleInputChange('embeddingModel', event.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option value="text-embedding-ada-002">text-embedding-ada-002</option><option value="text-embedding-3-small">text-embedding-3-small</option><option value="text-embedding-3-large">text-embedding-3-large</option>
                </select>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6"><Server className="w-6 h-6 text-orange-600" /><h3 className="text-lg font-semibold">System Status</h3></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {statusCard(config.provider === 'ollama' ? 'Ollama Connection' : 'OpenAI Connection', status.apiDetail, status.apiConnected, 'bg-green-50 border-green-200')}
            {statusCard('Vector Database', status.vectorActive ? 'Active' : 'No index loaded', status.vectorActive, 'bg-blue-50 border-blue-200')}
            {statusCard('Processing Engine', status.processingReady ? 'Ready' : 'Unavailable', status.processingReady, 'bg-purple-50 border-purple-200')}
          </div>
        </div>

        <div className="flex justify-end"><button onClick={handleSave} className={`inline-flex items-center px-6 py-3 rounded-lg text-white ${saved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}><Save className="w-4 h-4 mr-2" />{saved ? 'Saved!' : 'Save Settings'}</button></div>
      </div>
    </div>
  );
}
