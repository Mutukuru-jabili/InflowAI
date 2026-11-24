# InfoFlow AI - Enterprise RAG Chatbot System

A comprehensive Retrieval-Augmented Generation (RAG) chatbot system designed for enterprise knowledge management. InfoFlow AI processes multiple document formats, creates intelligent embeddings, and provides accurate responses using OpenAI's GPT-4.

## 🏗️ System Architecture

```
Frontend (React.js) ←→ Backend API (Spring Boot) ←→ AI Service (Python/LangChain)
       ↓                        ↓                          ↓
  Tailwind CSS           MySQL Database              Vector Store (FAISS)
```

## ✨ Features

- **Multi-format Document Support**: PDF, Word (.docx), and Text files
- **Advanced RAG Architecture**: Uses LangChain + OpenAI embeddings
- **Vector Database**: FAISS for fast similarity search
- **Modern UI**: React with Tailwind CSS and responsive design
- **Real-time Chat**: Interactive conversation interface
- **Document Management**: Upload, process, and manage knowledge base
- **Settings Dashboard**: Configure AI parameters and system settings
- **Streamlit Admin**: Alternative testing interface included

## 🛠️ Tech Stack

### Frontend
- **React.js** with TypeScript
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Vite** for fast development

### Backend API (To Implement)
- **Spring Boot** for robust API
- **MySQL** for structured data storage
- **RESTful endpoints** for frontend communication

### AI Layer (Implemented)
- **Python** with LangChain framework
- **OpenAI GPT-4** for language generation
- **FAISS** vector database for embeddings
- **Document processors** for PDF, DOCX, TXT

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- OpenAI API key

### 1. Frontend Setup (Already Running)
```bash
npm install
npm run dev  # Runs on http://localhost:5173
```

### 2. Python RAG Service Setup
```bash
cd backend
pip install -r requirements.txt

# Set your OpenAI API key
export OPENAI_API_KEY="your_api_key_here"

# Run the Flask API
python app.py  # Runs on http://localhost:5000
```

### 3. Streamlit Testing Interface
```bash
# Alternative: Run Streamlit UI for testing
chmod +x start-streamlit.sh
./start-streamlit.sh  # Runs on http://localhost:8501
```

## 📋 API Endpoints

The Python service provides these endpoints for integration:

```
POST /api/chat          - Send chat messages
POST /api/upload        - Upload documents
GET  /api/status        - System status
```

## 🔧 Configuration

### Environment Variables
```bash
# Required
OPENAI_API_KEY=your_openai_api_key

# Optional (defaults provided)
OPENAI_MODEL=gpt-4
OPENAI_TEMPERATURE=0.7
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

### Document Processing Settings
- **Chunk Size**: 1000 characters (adjustable)
- **Chunk Overlap**: 200 characters (adjustable)
- **Supported Formats**: PDF, DOCX, TXT
- **Max File Size**: 10MB

## 📖 Usage Guide

### 1. Upload Documents
- Use the Document Management interface
- Drag and drop or click to upload files
- Documents are automatically processed and chunked
- Vector embeddings are created and stored

### 2. Chat Interface
- Ask questions about uploaded documents
- Get contextual answers with source references
- View conversation history
- Sources are displayed with each response

### 3. Knowledge Base Management
- View document statistics
- Search through knowledge chunks
- Reindex vector database when needed
- Monitor system performance

## 🏭 Production Deployment

### Docker Compose (Recommended)
```yaml
version: '3.8'
services:
  frontend:
    build: .
    ports:
      - "80:80"
    environment:
      - VITE_API_URL=http://api:8080

  rag-service:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./data:/app/data
```

### Cloud Platforms
- **AWS**: ECS Fargate + RDS + S3
- **Vercel**: Frontend deployment
- **Railway**: Backend services
- **Digital Ocean**: Full stack deployment

## 🧪 Testing

### Postman Collection
Import the API collection for testing:
```json
{
  "info": { "name": "InfoFlow AI API" },
  "variable": [
    { "key": "baseUrl", "value": "http://localhost:5000" }
  ]
}
```

### Test Scenarios
1. **Document Upload**: Test various file formats
2. **Chat Queries**: Verify RAG responses
3. **Error Handling**: Invalid inputs and edge cases
4. **Performance**: Large documents and concurrent requests

## 🔒 Security Features

- **API Key Management**: Secure OpenAI key handling
- **File Validation**: Type and size restrictions
- **Error Handling**: Graceful failure management
- **CORS Configuration**: Secure cross-origin requests

## 📊 Monitoring

### System Metrics
- Document processing status
- Vector database size
- Query response times
- API usage statistics

### Health Checks
- OpenAI API connectivity
- Vector database status
- Document processor health
- Memory and disk usage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Troubleshooting

### Common Issues

**"OpenAI API key not found"**
```bash
export OPENAI_API_KEY="your_key_here"
```

**"Vector store not initialized"**
- Upload at least one document first
- Check file format support
- Verify OpenAI API connectivity

**"Port already in use"**
```bash
lsof -ti:5000 | xargs kill -9  # Kill process on port 5000
```

## 📞 Support

For support and questions:
- Check the integration guide: `integration-guide.md`
- Review API documentation
- Test with Streamlit interface first
- Monitor logs for error details

---

**InfoFlow AI** - Empowering enterprises with intelligent knowledge management through advanced RAG technology."# InflowAI" 
