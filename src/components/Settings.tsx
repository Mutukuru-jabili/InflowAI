import React, { useState } from 'react';
import { Save, Key, Database, Brain, Server } from 'lucide-react';

interface SettingsConfig {
  openaiApiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  chunkSize: number;
  chunkOverlap: number;
  vectorDatabase: string;
  embeddingModel: string;
}

export function Settings() {
  const [config, setConfig] = useState<SettingsConfig>({
    openaiApiKey: '',
    model: 'gpt-4',
    maxTokens: 2000,
    temperature: 0.7,
    chunkSize: 1000,
    chunkOverlap: 200,
    vectorDatabase: 'faiss',
    embeddingModel: 'text-embedding-ada-002'
  });

  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    // Simulate saving to backend
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleInputChange = (key: keyof SettingsConfig, value: string | number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Configure your InfoFlow AI system parameters</p>
      </div>

      <div className="space-y-8">
        {/* OpenAI Configuration */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Key className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">OpenAI Configuration</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={config.openaiApiKey}
                onChange={(e) => handleInputChange('openaiApiKey', e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model
              </label>
              <select
                value={config.model}
                onChange={(e) => handleInputChange('model', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Tokens: {config.maxTokens}
              </label>
              <input
                type="range"
                min="100"
                max="4000"
                step="100"
                value={config.maxTokens}
                onChange={(e) => handleInputChange('maxTokens', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temperature: {config.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.temperature}
                onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Document Processing */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Brain className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Document Processing</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chunk Size: {config.chunkSize} characters
              </label>
              <input
                type="range"
                min="500"
                max="2000"
                step="100"
                value={config.chunkSize}
                onChange={(e) => handleInputChange('chunkSize', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chunk Overlap: {config.chunkOverlap} characters
              </label>
              <input
                type="range"
                min="50"
                max="500"
                step="50"
                value={config.chunkOverlap}
                onChange={(e) => handleInputChange('chunkOverlap', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Vector Database */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Database className="w-6 h-6 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Vector Database</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vector Database
              </label>
              <select
                value={config.vectorDatabase}
                onChange={(e) => handleInputChange('vectorDatabase', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="faiss">FAISS</option>
                <option value="pinecone">Pinecone</option>
                <option value="chroma">Chroma</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Embedding Model
              </label>
              <select
                value={config.embeddingModel}
                onChange={(e) => handleInputChange('embeddingModel', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="text-embedding-ada-002">text-embedding-ada-002</option>
                <option value="text-embedding-3-small">text-embedding-3-small</option>
                <option value="text-embedding-3-large">text-embedding-3-large</option>
              </select>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Server className="w-6 h-6 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-2"></div>
              <p className="text-sm font-medium text-green-800">API Connection</p>
              <p className="text-xs text-green-600">Connected</p>
            </div>
            
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="w-3 h-3 bg-blue-500 rounded-full mx-auto mb-2"></div>
              <p className="text-sm font-medium text-blue-800">Vector Database</p>
              <p className="text-xs text-blue-600">Active</p>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="w-3 h-3 bg-purple-500 rounded-full mx-auto mb-2"></div>
              <p className="text-sm font-medium text-purple-800">Processing Engine</p>
              <p className="text-xs text-purple-600">Ready</p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className={`inline-flex items-center px-6 py-3 rounded-lg transition-colors ${
              saved 
                ? 'bg-green-600 text-white' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Save className="w-4 h-4 mr-2" />
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}