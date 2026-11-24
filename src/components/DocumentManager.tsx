import React, { useEffect, useState } from 'react';
import { Upload, FileText, File, Trash2, Search, AlertCircle } from 'lucide-react';
import { apiRequest } from '../api';

interface Document {
  id: string;
  name: string;
  type: string;
  sizeLabel: string;
  uploadDate: string;
  status: 'processing' | 'ready' | 'error';
  chunks: number;
  error?: string;
}

export function DocumentManager() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);

  const loadDocuments = async () => {
    try {
      const data = await apiRequest<{ documents: Document[] }>('/api/documents');
      setDocuments(data.documents);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not load documents.');
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    setUploadError('');
    setUploading(true);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      try {
        await apiRequest('/api/upload', { method: 'POST', body: form });
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : `Could not upload ${file.name}.`);
      }
    }
    setUploading(false);
    await loadDocuments();
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    handleFileUpload(event.dataTransfer.files);
  };

  const deleteDocument = async (id: string) => {
    try {
      await apiRequest(`/api/documents/${id}`, { method: 'DELETE' });
      await loadDocuments();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Could not delete document.');
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: Document['status']) => {
    if (status === 'ready') return 'text-green-700 bg-green-50 border-green-200';
    if (status === 'processing') return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    return 'text-red-700 bg-red-50 border-red-200';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Document Management</h1>
        <p className="text-gray-600">Upload and manage documents for your knowledge base</p>
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-8 mb-8 text-center transition-colors ${
          dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Drop files here or click to upload</h3>
        <p className="text-gray-600 mb-4">Supports PDF, DOCX, and TXT files up to 10MB</p>
        <input type="file" multiple accept=".pdf,.docx,.txt" onChange={(event) => handleFileUpload(event.target.files)} className="hidden" id="file-upload" />
        <label htmlFor="file-upload" className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? 'Uploading...' : 'Choose Files'}
        </label>
      </div>

      {uploadError && (
        <div className="mb-6 flex items-start space-x-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{uploadError}</p>
        </div>
      )}

      <div className="mb-6">
        <div className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input type="text" placeholder="Search documents..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Documents ({filteredDocuments.length})</h3>
        </div>
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
            <p className="text-gray-600">Upload your first document to get started</p>
          </div>
        ) : (
          <div className="divide-y border-gray-200">
            {filteredDocuments.map((doc) => (
              <div key={doc.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <File className="w-8 h-8 text-blue-600" />
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{doc.name}</h4>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-gray-500">{doc.type} • {doc.sizeLabel}</span>
                        <span className="text-xs text-gray-500">{new Date(doc.uploadDate).toLocaleDateString()}</span>
                        {doc.status === 'ready' && <span className="text-xs text-gray-500">{doc.chunks} chunks</span>}
                      </div>
                      {doc.error && <p className="mt-1 text-xs text-red-600">{doc.error}</p>}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(doc.status)}`}>{doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}</span>
                    <button onClick={() => deleteDocument(doc.id)} className="p-1 text-gray-400 hover:text-red-600" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
