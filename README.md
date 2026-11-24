# InfoFlow AI

InfoFlow AI is a document question-answering application that uses a React frontend, a Flask API, FAISS, and either local Ollama models or OpenAI for embeddings and chat.

For the full architecture, data flow, API reference, Windows notes, and glossary, see [PROJECT_GUIDE.md](./PROJECT_GUIDE.md).

## Windows setup

Requirements:
- Windows 10/11
- Python 3.11
- Node.js 18 or newer
- [Ollama for Windows](https://ollama.com/download) (recommended for local, no-API-billing use)

### 1. Configure the backend

Open Command Prompt in the project root:

```bat
cd backend
copy .env.example .env
```

The default provider is Ollama. Install Ollama, then open a separate Command Prompt and download the default local models:

```bat
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
```

Ollama should be running at `http://localhost:11434`. You can verify it with:

```bat
ollama list
```

To store model files on another drive instead of the default user profile, set `OLLAMA_MODELS` before starting Ollama. For example, in PowerShell:

```powershell
[Environment]::SetEnvironmentVariable("OLLAMA_MODELS", "D:\OllamaModels", "User")
```

Restart Ollama after changing this variable.

OpenAI remains optional. To use it instead, select **OpenAI API** in the Settings page and provide an API key with available API credits. ChatGPT subscriptions do not provide API credits.

Create a virtual environment and install dependencies:

```bat
python -m venv venv
venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Start the backend:

```bat
python app.py
```

The API will start at `http://localhost:5000`.

### 2. Start the frontend

Open another Command Prompt in the project root:

```bat
npm install
npm run dev
```

Open `http://localhost:5173`.

## Supported workflow

1. Upload PDF, DOCX, or TXT files from the Documents page.
2. InfoFlow extracts text, creates overlapping chunks, generates local Ollama embeddings by default, and stores them in FAISS.
3. Ask questions on the Chat page.
4. The backend retrieves relevant chunks and sends them with the question to the selected local Ollama or OpenAI chat model.
5. Answers include source document names and pages when available.

## Persistence

Backend state is stored under `backend\data`:
- `infoflow.db` contains document metadata and application state.
- `vector\index.faiss` contains the persistent FAISS index.
- `vector\chunks.json` contains indexed chunk text and source metadata.
- `uploads` contains preserved source files.

Reindexing rebuilds the FAISS index from preserved source files.
If you change the provider or embedding model, use **Reindex Knowledge Base** to rebuild vectors using the selected embedding model. Ollama and OpenAI indexes cannot be mixed.

## API endpoints

- `GET /api/status`
- `GET /api/documents`
- `POST /api/upload`
- `DELETE /api/documents/<id>`
- `POST /api/chat`
- `POST /api/search`
- `GET /api/knowledge`
- `POST /api/reindex`
- `GET /api/export`
- `GET /api/settings`
- `POST /api/settings`

Set `VITE_API_URL` before starting Vite only if the backend is hosted at an address other than `http://localhost:5000`.
