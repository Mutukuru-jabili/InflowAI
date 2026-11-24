# InfoFlow AI: Architecture, Workflow, and Glossary

## 1. Project overview

InfoFlow AI is a document question-answering application. Users upload PDF, DOCX, and TXT files, then ask questions about their contents. The backend extracts and divides the text, creates numeric representations of the text (embeddings), saves those vectors in FAISS, retrieves relevant passages, and asks a language model to answer using those passages.

The default model provider is **Ollama**, which runs models on the local computer and does not require OpenAI API credits. OpenAI is an optional provider that requires a configured API key and available API billing.

The current application uses a React web frontend and one Python/Flask backend. The README's old Spring Boot/MySQL diagram describes a planned architecture, not a component used by the current application. The current backend uses SQLite for document records.

## 2. Architecture at a glance

```text
┌──────────────────────────────────┐
│ Browser                          │
│ React + TypeScript + Vite        │
│ Chat / Documents / Knowledge /   │
│ Settings                         │
└────────────────┬─────────────────┘
                 │ HTTP + JSON or multipart file upload
                 ▼
┌──────────────────────────────────┐
│ Flask API (Python)               │
│ Validation, extraction, chunking,│
│ embeddings, retrieval, answers   │
└──────────┬───────────────┬───────┘
           │               │
           │               ├── SQLite: document and system metadata
           │               ├── Source files: backend/data/uploads/
           │               └── FAISS index + chunk metadata:
           │                   backend/data/vector/
           ▼
┌──────────────────────────────────┐
│ Model provider                   │
│ Ollama on localhost (default)    │
│ or OpenAI API (optional)         │
│ Chat completion + text embeddings│
└──────────────────────────────────┘
```

### Main code locations

| Location | Responsibility |
| --- | --- |
| `src/App.tsx` | Selects and displays the active application page. |
| `src/api.ts` | Shared frontend HTTP client and backend URL. |
| `src/components/ChatInterface.tsx` | Sends chat questions and displays answers and sources. |
| `src/components/DocumentManager.tsx` | Uploads, lists, and deletes documents. |
| `src/components/KnowledgeBase.tsx` | Displays backend statistics, searches chunks, reindexes, and exports the index. |
| `src/components/Settings.tsx` | Selects the model provider and configures model and processing options. |
| `backend/app.py` | Flask routes, file processing, model calls, FAISS operations, and persistence. |
| `backend/data/infoflow.db` | SQLite document registry and system state. |
| `backend/data/uploads/` | Persisted uploaded source files. |
| `backend/data/vector/index.faiss` | Persisted FAISS vector index. |
| `backend/data/vector/chunks.json` | Text chunks and their source metadata, aligned with the FAISS index. |

Generated backend data is local application state, not source code. Keep the SQLite database, uploaded files, FAISS index, and chunk metadata together when backing up the knowledge base.

## 3. Technology stack

### Frontend

- **React**: JavaScript library used to build the user interface from components.
- **TypeScript**: JavaScript with static type checking; used for the frontend source.
- **Vite**: Development server and production build tool. The frontend normally runs at `http://localhost:5173`.
- **Tailwind CSS**: Utility-class-based styling used by the existing UI.
- **Lucide React**: Icon library used by the pages.
- **Fetch API**: Browser API used by `src/api.ts` to call Flask.

### Backend and document processing

- **Python 3.11**: Backend programming language supported by this project setup.
- **Flask**: HTTP server and API route framework. The backend normally runs at `http://localhost:5000`.
- **Flask-CORS**: Allows the local frontend origin to call the backend from a browser.
- **pypdf**: Extracts text from PDF pages.
- **python-docx**: Extracts text from DOCX paragraphs and tables.
- **Python text decoding**: Reads TXT files, trying common encodings.
- **SQLite**: Stores document status, file metadata, hashes, chunk counts, and indexing time in `backend/data/infoflow.db`.
- **FAISS CPU**: Searches dense numeric vectors by similarity and stores the vector index locally.
- **NumPy**: Converts vectors to floating-point arrays and normalizes them before FAISS indexing/search.
- **python-dotenv**: Loads backend environment settings from `backend/.env`.
- **OpenAI Python SDK**: Used only when the OpenAI provider is selected.
- **Ollama HTTP API**: Used by default for local embedding and chat model requests. The backend calls Ollama's local API using Python's standard HTTP libraries; it does not need an extra Ollama Python package.

The current Flask RAG routes perform document processing directly. There is no separate Spring Boot service, MySQL database, LangChain runtime, or Streamlit server.

## 4. Document ingestion workflow

1. **Select or drop files.** The Documents page sends each file to `POST /api/upload` as multipart form data.
2. **Validate the upload.** The backend accepts PDF, DOCX, and TXT files, checks for empty files and enforces the configured maximum size (10 MB by default).
3. **Detect duplicates.** A SHA-256 hash identifies identical file contents. A completed duplicate is not indexed a second time. A document previously marked as failed can be retried.
4. **Preserve the original.** The file is stored under `backend/data/uploads/` with a hash-prefixed, sanitized filename. It is retained for reindexing after a restart.
5. **Extract text.** PDFs are read page by page; DOCX content is extracted from paragraphs and tables; TXT files are decoded using common encodings.
6. **Create chunks.** Text is divided into overlapping pieces. Defaults are 1,000 characters per chunk and 200 characters of overlap. Source filename and page number are attached as metadata.
7. **Create embeddings.** The selected provider turns each chunk into a vector. The backend normalizes the vectors and adds them to FAISS.
8. **Persist status and index.** SQLite records the document's status and chunk count; FAISS and `chunks.json` are saved under `backend/data/vector/`.
9. **Show the result.** The Documents and Knowledge Base pages reload their values from the backend rather than inventing sample statistics.

An upload is only **Ready** after text extraction, embedding, and indexing succeed. If a local model is unavailable, the document is marked **Error** with an actionable message; its preserved file can be indexed later.

## 5. Question-answering (RAG) workflow

1. The Chat page sends the user's question to `POST /api/chat`.
2. The selected embedding model embeds the question using the same model/provider used to build the index.
3. FAISS searches for the closest indexed chunk vectors.
4. The backend retrieves up to five candidates and keeps scores at or above `max(0.52, best score - 0.12)`. This relevance filter is intended to avoid passing weakly related chunks as evidence.
5. The backend sends the question and selected passages to the selected chat model with instructions to answer from that context and not invent unsupported facts.
6. The answer and the source filenames (plus page numbers when known) are returned to the frontend.
7. If the index is empty or no chunks pass the relevance filter, the backend says it could not find relevant indexed information instead of fabricating an answer.

The Knowledge Base semantic search uses the same FAISS index and embedding model. Its results display the chunk content, source, page when available, and similarity score.

### Why embeddings must match

The index is built from vectors of a particular size and model. Switching between OpenAI and Ollama, or changing the embedding model, changes the vectors and can change their dimensions. Vectors from different embedding models must not be mixed. Use **Reindex Knowledge Base** after changing the provider or embedding model; reindexing recreates the vectors from the preserved source files.

## 6. Model providers

### Ollama (default, local)

Ollama runs the selected models on this computer and exposes an HTTP API at `http://localhost:11434` by default. This project is currently configured with:

- Chat model: `qwen2.5:3b`
- Embedding model: `nomic-embed-text`
- Model storage on this computer: `D:\OllamaModels`
- Embedding vector dimensions currently indexed: 768

The model files are stored separately from this repository. Local inference does not incur OpenAI API charges, but it uses disk space, system memory, and CPU/GPU resources. Response speed depends on the computer.

To confirm Ollama and its models are available:

```bat
ollama list
```

If needed, download the configured models:

```bat
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
```

### OpenAI API (optional)

Selecting OpenAI in Settings uses the configured OpenAI chat and embedding models. This requires an API key with API access and available billing. A ChatGPT subscription is separate from OpenAI API billing.

Keep the API key in `backend/.env` or enter it in Settings. The key is not returned in settings/status responses and must not be committed to source control. Entering a key in Settings changes the running backend process; configure `backend/.env` if it must remain set after a backend restart.

## 7. Pages and API routes

| Page or route | Purpose |
| --- | --- |
| Chat page | Ask questions and display grounded answers and source references. |
| Documents page | Upload, filter, inspect status, and delete source documents. |
| Knowledge Base page | Display real document/chunk/vector statistics, perform semantic search, reindex, and export. |
| Settings page | Select Ollama or OpenAI and configure provider, model, chunking, and generation settings. |
| `GET /` | Backend service information and frontend URL. |
| `GET /api/status` | Backend, provider, vector index, document, and chunk health. |
| `GET /api/documents` | Persisted document list and processing statuses. |
| `POST /api/upload` | Validate, preserve, process, and index one file. |
| `DELETE /api/documents/<id>` | Delete a document and rebuild the index without its chunks. |
| `POST /api/chat` | Retrieve context and generate a grounded answer. |
| `POST /api/search` | Return semantically similar chunks. |
| `GET /api/knowledge` | Return actual document, chunk, dimension, and indexing-time statistics. |
| `POST /api/reindex` | Rebuild vectors from the preserved uploaded files. |
| `GET /api/export` | Download a ZIP containing the FAISS index, chunk metadata, and non-secret runtime settings. |
| `GET /api/settings` | Return public provider/settings information and provider health; never returns the API key. |
| `POST /api/settings` | Save provider and non-secret runtime settings; accepts an optional API key for the running process. |

The frontend base URL defaults to `http://localhost:5000`; set `VITE_API_URL` before starting Vite to use a different backend host.

## 8. Windows startup

### Ollama

Install Ollama for Windows from [ollama.com/download](https://ollama.com/download). The local service should be available on port 11434. In Command Prompt, install the two model packages if they are not already present:

```bat
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
```

### Flask backend

In Command Prompt:

```bat
cd /d D:\AllProjects\InflowAi\InfoFlow-AI-DL\backend
venv\Scripts\activate.bat
python app.py
```

### React frontend

Open a second Command Prompt:

```bat
cd /d D:\AllProjects\InflowAi\InfoFlow-AI-DL
npm run dev
```

Open `http://localhost:5173`. Check `http://localhost:5000/api/status` to verify the backend and selected model provider.

## 9. Important limitations and operational notes

- This is a local development application, not a production-hardened multi-user service.
- The Flask CORS setup is permissive for local frontend development. Restrict allowed origins before exposing the backend to a network.
- The SQLite registry, original files, FAISS index, and chunk metadata are local state. Back them up together.
- The exported vector database does not include original uploaded documents or the SQLite registry.
- Reindexing requires the same source files to still exist and the selected embedding provider/model to be available.
- `DATABASE_URL` values in older local environment files are not used by the current direct SQLite implementation; SQLite is opened at `backend/data/infoflow.db`.
- No Spring Boot API or MySQL database is part of the current application runtime.

## 10. Glossary

| Term | Meaning in this project |
| --- | --- |
| **AI (Artificial Intelligence)** | Computer systems performing tasks commonly associated with human intelligence, such as language understanding or reasoning. |
| **API (Application Programming Interface)** | A defined way for software components to communicate. Here, the browser calls Flask's HTTP endpoints. |
| **Backend** | Server-side code that validates uploads, processes documents, calls models, searches vectors, and returns results. |
| **CORS (Cross-Origin Resource Sharing)** | Browser security mechanism controlling whether a web page at one origin may call a server at another origin. |
| **Chunk** | A smaller piece of extracted document text used for embedding and retrieval. Small pieces make it possible to retrieve relevant sections instead of sending entire files to a model. |
| **Chunk overlap** | Characters repeated at the boundary between adjacent chunks so that a sentence or idea split at a boundary retains context. |
| **Chat completion** | Model-generated text produced in response to a chat prompt and its messages. |
| **Context** | The retrieved document passages supplied to the chat model along with the user's question. |
| **DOCX** | Microsoft Word's modern XML-based document file format. |
| **Embedding** | A list of numbers that represents semantic features of text. Similar meanings tend to have vectors that are close in the embedding space. |
| **FAISS** | Facebook AI Similarity Search, a library for storing and searching vectors efficiently. |
| **Flask** | A lightweight Python web framework used to implement the backend HTTP routes. |
| **HTTP** | Hypertext Transfer Protocol, the request/response protocol used between the browser, backend, and local Ollama service. |
| **Index** | A searchable data structure. In this application, FAISS maps vectors to chunk records stored in the same order in `chunks.json`. |
| **Inference** | Running a trained model to produce an embedding or generated answer. Local Ollama inference runs on this computer. |
| **JSON** | JavaScript Object Notation, a text format used for API request/response bodies and stored chunk metadata. |
| **LLM (Large Language Model)** | A model trained on large amounts of text that can generate and interpret language. Qwen and GPT are examples of chat models. |
| **Metadata** | Descriptive information attached to a chunk or document, such as filename, page, upload time, or status. |
| **ML (Machine Learning)** | A branch of AI in which a system learns patterns from data rather than relying only on manually written rules. |
| **Model** | A trained machine-learning system. This application uses one model for chat generation and another for text embeddings. |
| **OpenAI API key** | A secret credential used to authorize requests to OpenAI's hosted API. It is not the same as a ChatGPT password or subscription. |
| **Ollama** | A local model runtime that downloads, manages, and serves language and embedding models on the computer. |
| **OCR (Optical Character Recognition)** | Technology that turns text shown in an image into machine-readable text. This application does not currently run OCR, so image-only/scanned PDFs may produce no extractable text. |
| **PDF** | Portable Document Format. The backend extracts text page by page when the PDF contains machine-readable text. |
| **Prompt** | Instructions and input sent to a language model. The RAG prompt contains retrieved context and the user's question. |
| **RAG (Retrieval-Augmented Generation)** | A design that first retrieves relevant information from a knowledge collection and then gives it to a language model to ground its answer. |
| **REST endpoint / route** | A URL and HTTP method that performs an operation, such as `POST /api/chat`. |
| **Semantic search** | Search based on vector meaning/similarity rather than only exact keyword matches. |
| **Similarity score** | Numeric indication of how close a query vector is to a chunk vector. Higher scores indicate closer matches for the normalized inner-product index used here; it is not a probability. |
| **Source attribution** | Returning the document name and, where available, page number for passages used to answer a question. |
| **SQLite** | A small relational database stored in a local file; used here for document and system metadata. |
| **Temperature** | Generation setting that influences variation in model output. Lower values generally make answers more predictable. |
| **Token** | A unit of text processed by a language model. A token can be a word, part of a word, punctuation, or whitespace. |
| **Vector** | An ordered list of numeric values. Embeddings are vectors that can be compared mathematically. |
| **Vector dimension** | Number of numeric values in each embedding. The current `nomic-embed-text` vectors have 768 dimensions. |
| **Vite** | Frontend development server and build tool that serves the React application and creates production assets. |

