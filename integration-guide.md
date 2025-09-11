# InfoFlow AI - Integration Guide

## System Architecture Overview

InfoFlow AI follows a modern microservices architecture with clear separation of concerns:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React.js      │    │   Spring Boot    │    │   Python RAG    │
│   Frontend      │◄──►│   Backend API    │◄──►│   AI Service    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Tailwind CSS  │    │     MySQL DB     │    │  Vector Store   │
│   Lucide Icons  │    │  (Structured)    │    │   (FAISS/Pine)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Layer-by-Layer Implementation

### 1. Frontend Layer (React.js)

**Current Status:** ✅ Implemented
- Modern React app with TypeScript
- Tailwind CSS for styling
- Component-based architecture
- Responsive design

**API Integration:**
```javascript
// src/services/api.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

export const apiService = {
  // Chat with AI
  sendMessage: async (message) => {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    return response.json();
  },

  // Upload document
  uploadDocument: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: 'POST',
      body: formData
    });
    return response.json();
  },

  // Get documents
  getDocuments: async () => {
    const response = await fetch(`${API_BASE_URL}/documents`);
    return response.json();
  }
};
```

### 2. Backend Layer (Spring Boot)

**Implementation Needed:**
Create a Spring Boot application that serves as the main API gateway:

```java
// DocumentController.java
@RestController
@RequestMapping("/api/documents")
@CrossOrigin(origins = "http://localhost:3000")
public class DocumentController {
    
    @Autowired
    private DocumentService documentService;
    
    @PostMapping("/upload")
    public ResponseEntity<?> uploadDocument(@RequestParam("file") MultipartFile file) {
        try {
            // Save to MySQL
            Document doc = documentService.saveDocument(file);
            
            // Forward to Python RAG service
            ragService.processDocument(file);
            
            return ResponseEntity.ok(doc);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
    
    @GetMapping
    public List<Document> getAllDocuments() {
        return documentService.findAll();
    }
}

// ChatController.java
@RestController
@RequestMapping("/api/chat")
@CrossOrigin(origins = "http://localhost:3000")
public class ChatController {
    
    @Autowired
    private PythonRagService ragService;
    
    @PostMapping
    public ResponseEntity<ChatResponse> chat(@RequestBody ChatRequest request) {
        try {
            ChatResponse response = ragService.processQuery(request.getMessage());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(500)
                .body(new ChatResponse("Error processing request", null));
        }
    }
}
```

**Database Configuration:**
```java
// application.yml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/infoflow_ai
    username: ${DB_USERNAME:root}
    password: ${DB_PASSWORD:password}
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true

# Python RAG Service
python:
  rag:
    service:
      url: http://localhost:5000/api
```

### 3. AI Layer (Python RAG Service)

**Current Status:** ✅ Implemented
- Complete RAG implementation with LangChain
- FAISS vector database integration
- OpenAI GPT-4 integration
- Document processing pipeline
- REST API endpoints

**Service Integration:**
```java
// PythonRagService.java (Spring Boot)
@Service
public class PythonRagService {
    
    @Value("${python.rag.service.url}")
    private String ragServiceUrl;
    
    private final RestTemplate restTemplate;
    
    public ChatResponse processQuery(String message) {
        String url = ragServiceUrl + "/chat";
        Map<String, String> request = Map.of("message", message);
        
        ResponseEntity<Map> response = restTemplate.postForEntity(
            url, request, Map.class);
            
        return mapToResponse(response.getBody());
    }
    
    public void processDocument(MultipartFile file) {
        // Forward file to Python service for RAG processing
        String url = ragServiceUrl + "/upload";
        // Implementation details...
    }
}
```

### 4. Data Layer Implementation

**MySQL Schema (Spring Boot):**
```sql
CREATE DATABASE infoflow_ai;

-- Documents table
CREATE TABLE documents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('PROCESSING', 'READY', 'ERROR') DEFAULT 'PROCESSING',
    chunks_count INT DEFAULT 0,
    file_path VARCHAR(500)
);

-- Chat history
CREATE TABLE chat_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_message TEXT NOT NULL,
    ai_response TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processing_time_ms INT
);

-- Document chunks metadata
CREATE TABLE document_chunks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    document_id BIGINT NOT NULL,
    chunk_index INT NOT NULL,
    content_preview TEXT,
    vector_id VARCHAR(255),
    FOREIGN KEY (document_id) REFERENCES documents(id)
);
```

**Vector Store (Python/FAISS):**
The Python service handles all vector operations automatically.

## Deployment Architecture

### 1. Local Development Setup

```bash
# 1. Frontend (React)
cd frontend
npm install
npm start  # Runs on http://localhost:3000

# 2. Backend (Spring Boot)
cd backend-spring
./mvnw spring-boot:run  # Runs on http://localhost:8080

# 3. AI Service (Python)
cd backend
pip install -r requirements.txt
python app.py  # Runs on http://localhost:5000

# 4. Database
docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=password mysql:8.0
```

### 2. Production Deployment

**AWS Architecture:**
```yaml
# docker-compose.yml
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    environment:
      - REACT_APP_API_URL=http://api:8080/api

  api:
    build: ./backend-spring
    ports:
      - "8080:8080"
    environment:
      - DB_HOST=database
      - PYTHON_RAG_URL=http://rag-service:5000/api
    depends_on:
      - database
      - rag-service

  rag-service:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./data:/app/data

  database:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_PASSWORD}
      - MYSQL_DATABASE=infoflow_ai
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

### 3. Cloud Deployment Options

**Option A: AWS**
- Frontend: Deploy to S3 + CloudFront
- Spring Boot API: ECS Fargate or EC2
- Python RAG Service: ECS Fargate with GPU support
- Database: RDS MySQL
- Vector Storage: EFS or S3

**Option B: Vercel + Railway**
- Frontend: Vercel
- Spring Boot API: Railway
- Python RAG Service: Railway (with persistent storage)
- Database: Railway MySQL

## Environment Configuration

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:8080/api
REACT_APP_APP_NAME=InfoFlow AI
REACT_APP_VERSION=1.0.0
```

### Spring Boot (application.yml)
```yaml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:mysql://localhost:3306/infoflow_ai
    username: ${DB_USERNAME:root}
    password: ${DB_PASSWORD:password}
  
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 10MB

python:
  rag:
    service:
      url: ${RAG_SERVICE_URL:http://localhost:5000/api}
```

### Python RAG (.env)
```
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4
CHUNK_SIZE=1000
VECTOR_DB_TYPE=faiss
```

## Testing Strategy

### 1. Unit Tests
- React: Jest + React Testing Library
- Spring Boot: JUnit 5 + MockMvc
- Python: pytest + unittest

### 2. Integration Tests
- API endpoint testing with Postman collections
- End-to-end testing with Cypress
- Performance testing with JMeter

### 3. Postman Collection
```json
{
  "info": { "name": "InfoFlow AI API" },
  "item": [
    {
      "name": "Upload Document",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/documents/upload",
        "body": { "mode": "formdata" }
      }
    },
    {
      "name": "Chat Query",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/api/chat",
        "body": {
          "raw": "{\"message\": \"What is our remote work policy?\"}"
        }
      }
    }
  ]
}
```

## Next Steps for Full Implementation

1. **Create Spring Boot Backend:**
   ```bash
   spring init --dependencies=web,data-jpa,mysql --name=infoflow-api backend-spring
   ```

2. **Set up MySQL Database:**
   - Install MySQL server
   - Create database schema
   - Configure connection properties

3. **Deploy Python RAG Service:**
   - Set up virtual environment
   - Install dependencies
   - Configure OpenAI API key

4. **Connect All Services:**
   - Update API endpoints in React
   - Configure Spring Boot to communicate with Python service
   - Test full integration

5. **Add Authentication (Optional):**
   - Spring Security for API protection
   - JWT tokens for session management
   - Role-based access control

This architecture provides a scalable, maintainable solution for your InfoFlow AI system with clear separation of concerns and modern best practices.