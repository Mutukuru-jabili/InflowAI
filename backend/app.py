import os
import json
import hashlib
import logging
import sqlite3
import threading
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from openai import OpenAI
from openai import APIConnectionError, AuthenticationError
import faiss
import numpy as np
from pypdf import PdfReader
from docx import Document as DocxDocument

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
VECTOR_DIR = DATA_DIR / "vector"
DB_PATH = DATA_DIR / "infoflow.db"
FAISS_PATH = VECTOR_DIR / "index.faiss"
CHUNKS_PATH = VECTOR_DIR / "chunks.json"
CONFIG_PATH = DATA_DIR / "runtime_config.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
VECTOR_DIR.mkdir(parents=True, exist_ok=True)


def iso_now():
    return datetime.now().isoformat()


def default_config():
    return {
        "openai_model": os.getenv("OPENAI_MODEL", "gpt-4"),
        "temperature": float(os.getenv("OPENAI_TEMPERATURE", "0.7")),
        "max_tokens": int(os.getenv("OPENAI_MAX_TOKENS", "2000")),
        "chunk_size": int(os.getenv("CHUNK_SIZE", "1000")),
        "chunk_overlap": int(os.getenv("CHUNK_OVERLAP", "200")),
        "embedding_model": os.getenv("EMBEDDING_MODEL", "text-embedding-ada-002"),
        "vector_db_type": os.getenv("VECTOR_DB_TYPE", "faiss"),
        "max_file_size": int(os.getenv("MAX_FILE_SIZE", "10485760")),
    }


def load_runtime_config():
    config = default_config()
    if CONFIG_PATH.exists():
        try:
            config.update(json.loads(CONFIG_PATH.read_text(encoding="utf-8")))
        except Exception as exc:
            logger.warning("Could not read runtime config: %s", exc)
    return config


runtime_config = load_runtime_config()
lock = threading.RLock()


class Database:
    def __init__(self, path):
        self.path = str(path)
        self.init()

    def connect(self):
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def init(self):
        with self.connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    size INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    chunks INTEGER NOT NULL DEFAULT 0,
                    sha256 TEXT UNIQUE,
                    stored_path TEXT NOT NULL,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    indexed_at TEXT
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS system_state (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )

    def list_documents(self):
        with self.connect() as conn:
            return [dict(row) for row in conn.execute(
                "SELECT * FROM documents ORDER BY id DESC"
            )]

    def get_document(self, document_id):
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
            return dict(row) if row else None

    def get_by_hash(self, sha256):
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM documents WHERE sha256 = ?", (sha256,)).fetchone()
            return dict(row) if row else None

    def add_document(self, values):
        with self.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO documents
                (name, type, size, status, chunks, sha256, stored_path, error, created_at, indexed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    values["name"], values["type"], values["size"], values["status"],
                    values["chunks"], values["sha256"], values["stored_path"],
                    values.get("error"), values["created_at"], values.get("indexed_at"),
                ),
            )
            return cursor.lastrowid

    def update_document(self, document_id, status, chunks, error=None, indexed_at=None):
        with self.connect() as conn:
            conn.execute(
                "UPDATE documents SET status=?, chunks=?, error=?, indexed_at=? WHERE id=?",
                (status, chunks, error, indexed_at, document_id),
            )

    def delete_document(self, document_id):
        document = self.get_document(document_id)
        if not document:
            return None
        with self.connect() as conn:
            conn.execute("DELETE FROM documents WHERE id=?", (document_id,))
        return document

    def set_state(self, key, value):
        with self.connect() as conn:
            conn.execute(
                "INSERT INTO system_state(key, value) VALUES(?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, value),
            )

    def get_state(self, key, default=None):
        with self.connect() as conn:
            row = conn.execute("SELECT value FROM system_state WHERE key=?", (key,)).fetchone()
            return row["value"] if row else default


db = Database(DB_PATH)


class RAGStore:
    def __init__(self):
        self.index = None
        self.chunks = []
        self.load()

    def openai_client(self):
        return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    def normalize_embeddings(self, vectors):
        values = np.asarray(vectors, dtype="float32")
        if values.ndim == 1:
            values = values.reshape(1, -1)
        norms = np.linalg.norm(values, axis=1, keepdims=True)
        return values / np.maximum(norms, 1e-12)

    def embed_texts(self, texts):
        if not texts:
            return []
        if not os.getenv("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY is not configured")
        client = self.openai_client()
        response = client.embeddings.create(
            model=runtime_config["embedding_model"],
            input=texts,
        )
        vectors = [item.embedding for item in response.data]
        return self.normalize_embeddings(vectors).tolist()

    def embed_query(self, text):
        vectors = self.embed_texts([text])
        if not vectors:
            raise RuntimeError("Embedding service returned no vector")
        return np.asarray(vectors[0], dtype="float32")

    def save(self):
        if self.index is not None:
            faiss.write_index(self.index, str(FAISS_PATH))
        CHUNKS_PATH.write_text(json.dumps(self.chunks, ensure_ascii=False), encoding="utf-8")
        db.set_state("last_indexed_at", iso_now())

    def load(self):
        if FAISS_PATH.exists() and CHUNKS_PATH.exists():
            try:
                self.index = faiss.read_index(str(FAISS_PATH))
                self.chunks = json.loads(CHUNKS_PATH.read_text(encoding="utf-8"))
                logger.info("Loaded FAISS index with %d chunks", len(self.chunks))
            except Exception as exc:
                logger.error("Could not load FAISS index: %s", exc)
                self.index = None
                self.chunks = []

    def reset(self):
        self.index = None
        self.chunks = []
        for path in (FAISS_PATH, CHUNKS_PATH):
            if path.exists():
                path.unlink()

    def add_chunks(self, chunks):
        if not chunks:
            return
        vectors = self.embed_texts([chunk["content"] for chunk in chunks])
        matrix = np.asarray(vectors, dtype="float32")
        if self.index is None:
            self.index = faiss.IndexFlatIP(matrix.shape[1])
        if self.index.d != matrix.shape[1]:
            raise RuntimeError("Embedding dimensions changed. Reindex the knowledge base.")
        self.index.add(matrix)
        self.chunks.extend(chunks)
        self.save()

    def rebuild_from_chunks(self, chunks):
        self.reset()
        if chunks:
            vectors = self.embed_texts([chunk["content"] for chunk in chunks])
            matrix = np.asarray(vectors, dtype="float32")
            self.index = faiss.IndexFlatIP(matrix.shape[1])
            self.index.add(matrix)
            self.chunks = chunks
            self.save()
        else:
            db.set_state("last_indexed_at", iso_now())

    def search(self, query, k=5):
        if self.index is None or not self.chunks:
            return []
        vector = self.embed_query(query).reshape(1, -1)
        count = min(k, len(self.chunks), self.index.ntotal)
        scores, ids = self.index.search(vector, count)
        results = []
        for score, chunk_id in zip(scores[0], ids[0]):
            if chunk_id < 0:
                continue
            item = dict(self.chunks[int(chunk_id)])
            item["similarity"] = float(score)
            results.append(item)
        return results

    def dimensions(self):
        return int(self.index.d) if self.index is not None else 0


rag_store = RAGStore()


def extract_text(file_path):
    suffix = file_path.suffix.lower()
    if suffix == ".pdf":
        reader = PdfReader(str(file_path))
        pages = []
        for number, page in enumerate(reader.pages, 1):
            text = page.extract_text() or ""
            if text.strip():
                pages.append({"text": text, "page": number})
        return pages
    if suffix in (".docx", ".doc"):
        if suffix == ".doc":
            raise ValueError("Legacy .doc files are not supported; upload .docx instead.")
        document = DocxDocument(str(file_path))
        text = "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip())
        if not text.strip():
            # Include text from tables
            text = "\n".join(
                " | ".join(cell.text for cell in row.cells)
                for table in document.tables
                for row in table.rows
            )
        return [{"text": text, "page": None}] if text.strip() else []
    if suffix == ".txt":
        for encoding in ("utf-8-sig", "utf-8", "cp1252"):
            try:
                text = file_path.read_text(encoding=encoding)
                return [{"text": text, "page": None}] if text.strip() else []
            except UnicodeDecodeError:
                continue
        raise ValueError("The text file could not be decoded.")
    raise ValueError(f"Unsupported file type: {suffix or '(none)'}")


def chunk_text(pages, source_name):
    splitter_chunks = []
    size = max(100, int(runtime_config["chunk_size"]))
    overlap = max(0, min(int(runtime_config["chunk_overlap"]), size - 1))
    for page in pages:
        text = " ".join(page["text"].split())
        if not text:
            continue
        start = 0
        chunk_number = 0
        while start < len(text):
            end = min(start + size, len(text))
            content = text[start:end].strip()
            if content:
                splitter_chunks.append({
                    "content": content,
                    "source": source_name,
                    "page": page["page"],
                    "chunk": chunk_number,
                })
                chunk_number += 1
            if end == len(text):
                break
            start = end - overlap
    return splitter_chunks


def file_sha256(file_path):
    digest = hashlib.sha256()
    with file_path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def openai_api_connection():
    if not os.getenv("OPENAI_API_KEY"):
        return False, "API key not configured"
    try:
        OpenAI(api_key=os.getenv("OPENAI_API_KEY")).models.list()
        return True, "Connected"
    except AuthenticationError:
        return False, "Invalid API key"
    except APIConnectionError:
        return False, "Connection failed"
    except Exception as exc:
        return False, str(exc)


app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})


def document_payload(document):
    return {
        "id": str(document["id"]),
        "name": document["name"],
        "type": document["type"].upper(),
        "size": document["size"],
        "sizeLabel": f"{document['size'] / (1024 * 1024):.1f} MB",
        "uploadDate": document["created_at"],
        "status": document["status"],
        "chunks": document["chunks"],
        "error": document["error"],
    }


@app.route("/api/status", methods=["GET"])
def status():
    api_connected, api_detail = openai_api_connection()
    with lock:
        documents = db.list_documents()
        return jsonify({
            "status": "active",
            "documents": len([doc for doc in documents if doc["status"] == "ready"]),
            "total_documents": len(documents),
            "indexed_chunks": len(rag_store.chunks),
            "vector_dimensions": rag_store.dimensions(),
            "last_updated": db.get_state("last_indexed_at"),
            "api_connected": api_connected,
            "api_detail": api_detail,
            "vector_active": rag_store.index is not None,
            "processing_ready": True,
            "timestamp": iso_now(),
        })


@app.route("/api/documents", methods=["GET"])
def list_documents():
    with lock:
        return jsonify({"documents": [document_payload(doc) for doc in db.list_documents()]})


@app.route("/api/upload", methods=["POST"])
def upload_document():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    upload = request.files["file"]
    if not upload.filename:
        return jsonify({"error": "No file selected"}), 400

    from werkzeug.utils import secure_filename
    filename = secure_filename(upload.filename)
    suffix = Path(filename).suffix.lower()
    allowed = {".pdf", ".docx", ".txt"}
    if suffix not in allowed:
        return jsonify({"error": f"Unsupported file type '{suffix or '(none)'}'. Allowed types: PDF, DOCX, TXT."}), 400

    upload_size = request.content_length
    if upload_size and upload_size > runtime_config["max_file_size"] + 1024:
        return jsonify({"error": "File exceeds the 10 MB maximum size"}), 413

    temporary_path = UPLOAD_DIR / f"upload_{datetime.now().strftime('%Y%m%d%H%M%S%f')}_{filename}"
    upload.save(temporary_path)
    size = temporary_path.stat().st_size
    if size == 0:
        temporary_path.unlink(missing_ok=True)
        return jsonify({"error": "The uploaded file is empty."}), 400
    if size > runtime_config["max_file_size"]:
        temporary_path.unlink(missing_ok=True)
        return jsonify({"error": "File exceeds the 10 MB maximum size"}), 413

    digest = file_sha256(temporary_path)
    existing = db.get_by_hash(digest)
    if existing:
        temporary_path.unlink(missing_ok=True)
        return jsonify({
            "status": "duplicate",
            "message": f"{filename} is already in the knowledge base.",
            "document": document_payload(existing),
        }), 200

    stored_name = f"{digest[:12]}_{filename}"
    stored_path = UPLOAD_DIR / stored_name
    temporary_path.replace(stored_path)
    document_id = db.add_document({
        "name": filename,
        "type": suffix.lstrip("."),
        "size": size,
        "status": "processing",
        "chunks": 0,
        "sha256": digest,
        "stored_path": str(stored_path),
        "error": None,
        "created_at": iso_now(),
        "indexed_at": None,
    })

    try:
        with lock:
            chunk_count = process_document(stored_path, document_id, filename)
        document = db.get_document(document_id)
        return jsonify({
            "status": "success",
            "message": f"Successfully processed {chunk_count} chunks from {filename}",
            "chunks": chunk_count,
            "file_name": filename,
            "document": document_payload(document),
        }), 200
    except Exception as exc:
        logger.exception("Document processing failed for %s", filename)
        db.update_document(document_id, "error", 0, str(exc), None)
        document = db.get_document(document_id)
        return jsonify({
            "status": "error",
            "error": str(exc),
            "message": f"Could not process {filename}: {exc}",
            "document": document_payload(document),
        }), 422


@app.route("/api/documents/<int:document_id>", methods=["DELETE"])
def delete_document(document_id):
    with lock:
        document = db.delete_document(document_id)
        if not document:
            return jsonify({"error": "Document not found"}), 404
        stored_path = Path(document["stored_path"])
        if stored_path.exists():
            stored_path.unlink()

        remaining_chunks = [
            chunk for chunk in rag_store.chunks
            if chunk.get("source") != document["name"]
        ]
        try:
            rag_store.rebuild_from_chunks(remaining_chunks)
        except Exception as exc:
            logger.exception("Failed to rebuild index after deleting document")
            return jsonify({"error": f"Document deleted but index rebuild failed: {exc}"}), 500
    return jsonify({"status": "success", "message": f"Deleted {document['name']}"}), 200


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    question = str(data.get("message") or data.get("question") or "").strip()
    if not question:
        return jsonify({"error": "No message provided"}), 400
    if rag_store.index is None or not rag_store.chunks:
        return jsonify({
            "status": "success",
            "answer": "No documents are currently indexed. Upload PDF, DOCX, or TXT documents before asking questions.",
            "sources": [],
            "question": question,
            "timestamp": iso_now(),
        })

    try:
        with lock:
            retrieved = rag_store.search(question, k=min(5, len(rag_store.chunks)))
        relevant = [item for item in retrieved if item["similarity"] >= 0.25]
        if not relevant:
            return jsonify({
                "status": "success",
                "answer": "I could not find relevant information in the indexed documents for this question.",
                "sources": [],
                "question": question,
                "timestamp": iso_now(),
            })

        context_blocks = []
        for index, item in enumerate(relevant, 1):
            page = f", page {item['page']}" if item.get("page") else ""
            context_blocks.append(
                f"[Source {index}: {item['source']}{page}]\\n{item['content']}"
            )
        prompt = (
            "Answer the question using only the retrieved context below. "
            "If the context does not contain the answer, say that it is not present. "
            "Do not invent facts or source names.\\n\\n"
            f"Context:\\n{chr(10).join(context_blocks)}\\n\\n"
            f"Question:\\n{question}"
        )
        client = rag_store.openai_client()
        response = client.chat.completions.create(
            model=runtime_config["openai_model"],
            temperature=float(runtime_config["temperature"]),
            max_tokens=int(runtime_config["max_tokens"]),
            messages=[
                {"role": "system", "content": "You are InfoFlow AI. Ground every answer in the supplied document context."},
                {"role": "user", "content": prompt},
            ],
        )
        answer = response.choices[0].message.content.strip()
        sources = [{
            "content": item["content"][:500],
            "source": item["source"],
            "page": item.get("page"),
            "similarity": item["similarity"],
        } for item in relevant]
        return jsonify({
            "status": "success",
            "answer": answer,
            "sources": sources,
            "question": question,
            "timestamp": iso_now(),
        })
    except Exception as exc:
        logger.exception("Chat query failed")
        return jsonify({"status": "error", "error": str(exc), "message": f"Chat request failed: {exc}"}), 500


@app.route("/api/search", methods=["POST"])
def search():
    data = request.get_json(silent=True) or {}
    query = str(data.get("query") or "").strip()
    if not query:
        return jsonify({"error": "Search query is required"}), 400
    try:
        with lock:
            results = rag_store.search(query, k=int(data.get("k", 10)))
        return jsonify({"query": query, "results": results})
    except Exception as exc:
        logger.exception("Knowledge search failed")
        return jsonify({"error": str(exc)}), 500


@app.route("/api/knowledge", methods=["GET"])
def knowledge():
    documents = db.list_documents()
    ready_documents = [doc for doc in documents if doc["status"] == "ready"]
    return jsonify({
        "totalDocuments": len(ready_documents),
        "totalChunks": len(rag_store.chunks),
        "vectorDimensions": rag_store.dimensions(),
        "lastUpdated": db.get_state("last_indexed_at"),
        "documents": [document_payload(doc) for doc in documents],
    })


@app.route("/api/reindex", methods=["POST"])
def reindex():
    try:
        with lock:
            rag_store.reset()
            documents = db.list_documents()
            ready_count = 0
            total_chunks = 0
            for document in documents:
                stored_path = Path(document["stored_path"])
                if not stored_path.exists():
                    db.update_document(document["id"], "error", 0, "Stored source file is missing.", None)
                    continue
                try:
                    chunk_count = process_document(stored_path, document["id"], document["name"])
                    rag_store.save()
                    ready_count += 1
                    total_chunks += chunk_count
                except Exception as exc:
                    db.update_document(document["id"], "error", 0, str(exc), None)
        db.set_state("last_indexed_at", iso_now())
        return jsonify({
            "status": "success",
            "message": f"Reindexed {ready_count} documents with {len(rag_store.chunks)} chunks.",
            "documents": ready_count,
            "chunks": len(rag_store.chunks),
        })
    except Exception as exc:
        logger.exception("Reindex failed")
        return jsonify({"status": "error", "error": str(exc)}), 500


@app.route("/api/export", methods=["GET"])
def export_vector_database():
    import io
    import zipfile
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        if FAISS_PATH.exists():
            archive.write(FAISS_PATH, "index.faiss")
        if CHUNKS_PATH.exists():
            archive.write(CHUNKS_PATH, "chunks.json")
        runtime_copy = dict(runtime_config)
        runtime_copy.pop("openai_api_key", None)
        archive.writestr("runtime_config.json", json.dumps(runtime_copy, indent=2))
    output.seek(0)
    return send_file(
        output,
        mimetype="application/zip",
        as_attachment=True,
        download_name="infoflow-vector-database.zip",
    )


@app.route("/api/settings", methods=["GET"])
def get_settings():
    api_connected, api_detail = openai_api_connection()
    public = {
        "openaiApiKeySet": bool(os.getenv("OPENAI_API_KEY")),
        "model": runtime_config["openai_model"],
        "maxTokens": runtime_config["max_tokens"],
        "temperature": runtime_config["temperature"],
        "chunkSize": runtime_config["chunk_size"],
        "chunkOverlap": runtime_config["chunk_overlap"],
        "vectorDatabase": runtime_config["vector_db_type"],
        "embeddingModel": runtime_config["embedding_model"],
    }
    return jsonify({
        "config": public,
        "status": {
            "apiConnected": api_connected,
            "apiDetail": api_detail,
            "vectorActive": rag_store.index is not None,
            "processingReady": True,
        },
    })


@app.route("/api/settings", methods=["PUT", "POST"])
def save_settings():
    global runtime_config
    data = request.get_json(silent=True) or {}
    old_embedding_model = runtime_config["embedding_model"]
    key = str(data.get("openaiApiKey") or "").strip()
    if key:
        os.environ["OPENAI_API_KEY"] = key

    allowed_values = {
        "openai_model": data.get("model"),
        "max_tokens": data.get("maxTokens"),
        "temperature": data.get("temperature"),
        "chunk_size": data.get("chunkSize"),
        "chunk_overlap": data.get("chunkOverlap"),
        "vector_db_type": data.get("vectorDatabase"),
        "embedding_model": data.get("embeddingModel"),
    }
    for key_name, value in allowed_values.items():
        if value is not None:
            runtime_config[key_name] = value

    runtime_config["temperature"] = max(0.0, min(1.0, float(runtime_config["temperature"])))
    runtime_config["max_tokens"] = max(1, int(runtime_config["max_tokens"]))
    runtime_config["chunk_size"] = max(100, int(runtime_config["chunk_size"]))
    runtime_config["chunk_overlap"] = max(
        0, min(int(runtime_config["chunk_overlap"]), runtime_config["chunk_size"] - 1)
    )

    CONFIG_PATH.write_text(json.dumps(runtime_config, indent=2), encoding="utf-8")
    if runtime_config["embedding_model"] != old_embedding_model:
        try:
            with lock:
                rag_store.rebuild_from_chunks(rag_store.chunks)
        except Exception as exc:
            return jsonify({"error": f"Settings saved, but vector reindex failed: {exc}"}), 500

    api_connected, api_detail = openai_api_connection()
    return jsonify({
        "status": "success",
        "message": "Settings saved.",
        "apiConnected": api_connected,
        "apiDetail": api_detail,
    })


if __name__ == "__main__":
    print("InfoFlow AI Backend Server Starting...")
    print("API Endpoints available at: http://localhost:5000/api/")
    app.run(
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", "5000")),
        debug=False,
    )


def process_document(file_path, document_id=None, source_name=None):
    name = source_name or file_path.name
    pages = extract_text(file_path)
    if not pages:
        raise ValueError("The document contains no extractable text.")
    chunks = chunk_text(pages, name)
    if not chunks:
        raise ValueError("The document produced no text chunks.")
    rag_store.add_chunks(chunks)
    if document_id:
        db.update_document(
            document_id, "ready", len(chunks), None, iso_now()
        )
    return len(chunks)
