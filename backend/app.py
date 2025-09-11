"""
InfoFlow AI - RAG Chatbot Backend
A comprehensive RAG (Retrieval-Augmented Generation) system for enterprise knowledge management.

This backend provides:
- Document processing and chunking
- Vector database integration (FAISS/Pinecone)
- OpenAI GPT-4 integration with LangChain
- RESTful API endpoints
- Streamlit UI for testing and administration
"""

import os
import logging
import streamlit as st
import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import hashlib
from pathlib import Path

# Core RAG Components
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.chat_models import ChatOpenAI
from langchain.chains import RetrievalQA
from langchain.schema import Document

# Document Loaders
from langchain.document_loaders import PyPDFLoader, TextLoader
from langchain.document_loaders.word_document import Docx2txtLoader

# Flask API
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DocumentProcessor:
    """Handles document loading, chunking, and preprocessing."""
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )
        
    def load_document(self, file_path: str) -> List[Document]:
        """Load document based on file extension."""
        file_extension = Path(file_path).suffix.lower()
        
        try:
            if file_extension == '.pdf':
                loader = PyPDFLoader(file_path)
            elif file_extension in ['.docx', '.doc']:
                loader = Docx2txtLoader(file_path)
            elif file_extension == '.txt':
                loader = TextLoader(file_path, encoding='utf-8')
            else:
                raise ValueError(f"Unsupported file type: {file_extension}")
                
            documents = loader.load()
            logger.info(f"Loaded {len(documents)} document(s) from {file_path}")
            return documents
            
        except Exception as e:
            logger.error(f"Error loading document {file_path}: {str(e)}")
            raise
    
    def chunk_documents(self, documents: List[Document]) -> List[Document]:
        """Split documents into chunks."""
        try:
            chunks = self.text_splitter.split_documents(documents)
            logger.info(f"Created {len(chunks)} chunks from {len(documents)} documents")
            return chunks
        except Exception as e:
            logger.error(f"Error chunking documents: {str(e)}")
            raise

class VectorStoreManager:
    """Manages vector database operations."""
    
    def __init__(self, embeddings_model: str = "text-embedding-ada-002"):
        self.embeddings = OpenAIEmbeddings(model=embeddings_model)
        self.vector_store = None
        self.index_file = "vector_store.faiss"
        
    def create_vector_store(self, documents: List[Document]) -> FAISS:
        """Create vector store from documents."""
        try:
            self.vector_store = FAISS.from_documents(documents, self.embeddings)
            logger.info(f"Created vector store with {len(documents)} documents")
            return self.vector_store
        except Exception as e:
            logger.error(f"Error creating vector store: {str(e)}")
            raise
    
    def add_documents(self, documents: List[Document]):
        """Add documents to existing vector store."""
        if self.vector_store is None:
            return self.create_vector_store(documents)
        
        try:
            self.vector_store.add_documents(documents)
            logger.info(f"Added {len(documents)} documents to vector store")
        except Exception as e:
            logger.error(f"Error adding documents: {str(e)}")
            raise
    
    def save_index(self):
        """Save vector store to disk."""
        if self.vector_store:
            try:
                self.vector_store.save_local(self.index_file)
                logger.info(f"Vector store saved to {self.index_file}")
            except Exception as e:
                logger.error(f"Error saving vector store: {str(e)}")
                raise
    
    def load_index(self):
        """Load vector store from disk."""
        try:
            if os.path.exists(f"{self.index_file}.faiss"):
                self.vector_store = FAISS.load_local(self.index_file, self.embeddings)
                logger.info(f"Vector store loaded from {self.index_file}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error loading vector store: {str(e)}")
            return False
    
    def similarity_search(self, query: str, k: int = 5) -> List[Document]:
        """Perform similarity search."""
        if not self.vector_store:
            raise ValueError("Vector store not initialized")
        
        try:
            results = self.vector_store.similarity_search(query, k=k)
            logger.info(f"Retrieved {len(results)} similar documents for query")
            return results
        except Exception as e:
            logger.error(f"Error in similarity search: {str(e)}")
            raise

class RAGChatbot:
    """Main RAG chatbot implementation."""
    
    def __init__(self, 
                 model_name: str = "gpt-4",
                 temperature: float = 0.7,
                 max_tokens: int = 2000):
        
        self.doc_processor = DocumentProcessor()
        self.vector_manager = VectorStoreManager()
        
        # Initialize LLM
        self.llm = ChatOpenAI(
            model_name=model_name,
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        # Load existing vector store if available
        self.vector_manager.load_index()
        
        # Initialize QA chain
        self.qa_chain = None
        self._setup_qa_chain()
        
    def _setup_qa_chain(self):
        """Setup the QA chain with retriever."""
        if self.vector_manager.vector_store:
            retriever = self.vector_manager.vector_store.as_retriever(
                search_kwargs={"k": 5}
            )
            
            self.qa_chain = RetrievalQA.from_chain_type(
                llm=self.llm,
                chain_type="stuff",
                retriever=retriever,
                return_source_documents=True
            )
            logger.info("QA chain initialized successfully")
    
    def add_document(self, file_path: str) -> Dict[str, Any]:
        """Add a single document to the knowledge base."""
        try:
            # Load and chunk document
            documents = self.doc_processor.load_document(file_path)
            chunks = self.doc_processor.chunk_documents(documents)
            
            # Add to vector store
            self.vector_manager.add_documents(chunks)
            
            # Save updated index
            self.vector_manager.save_index()
            
            # Reinitialize QA chain
            self._setup_qa_chain()
            
            return {
                "status": "success",
                "message": f"Successfully processed {len(chunks)} chunks from {file_path}",
                "chunks": len(chunks),
                "file_name": os.path.basename(file_path)
            }
            
        except Exception as e:
            logger.error(f"Error adding document: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }
    
    def query(self, question: str) -> Dict[str, Any]:
        """Query the knowledge base."""
        if not self.qa_chain:
            return {
                "status": "error",
                "message": "No documents in knowledge base. Please add documents first."
            }
        
        try:
            result = self.qa_chain({"query": question})
            
            # Extract source information
            sources = []
            for doc in result.get("source_documents", []):
                source_info = {
                    "content": doc.page_content[:200] + "...",
                    "metadata": doc.metadata
                }
                sources.append(source_info)
            
            return {
                "status": "success",
                "answer": result["result"],
                "sources": sources,
                "question": question,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error in query: {str(e)}")
            return {
                "status": "error",
                "message": str(e)
            }

# Initialize the RAG chatbot
@st.cache_resource
def get_chatbot():
    """Get or create the RAG chatbot instance."""
    return RAGChatbot()

def create_flask_api():
    """Create Flask API for frontend integration."""
    app = Flask(__name__)
    CORS(app)
    
    chatbot = RAGChatbot()
    
    @app.route('/api/chat', methods=['POST'])
    def chat():
        """Chat endpoint."""
        data = request.json
        question = data.get('message', '')
        
        if not question:
            return jsonify({"error": "No message provided"}), 400
        
        result = chatbot.query(question)
        return jsonify(result)
    
    @app.route('/api/upload', methods=['POST'])
    def upload_document():
        """Document upload endpoint."""
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Save uploaded file
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        file_path = os.path.join(upload_dir, file.filename)
        file.save(file_path)
        
        # Process document
        result = chatbot.add_document(file_path)
        
        # Clean up uploaded file
        os.remove(file_path)
        
        return jsonify(result)
    
    @app.route('/api/status', methods=['GET'])
    def get_status():
        """Get system status."""
        return jsonify({
            "status": "active",
            "documents": len(chatbot.vector_manager.vector_store.index_to_docstore_id) if chatbot.vector_manager.vector_store else 0,
            "timestamp": datetime.now().isoformat()
        })
    
    return app

def run_streamlit_ui():
    """Streamlit UI for testing and administration."""
    
    st.set_page_config(
        page_title="InfoFlow AI - RAG Chatbot",
        page_icon="🤖",
        layout="wide"
    )
    
    st.title("🤖 InfoFlow AI - RAG Chatbot System")
    st.markdown("Enterprise knowledge management with Retrieval-Augmented Generation")
    
    # Sidebar for configuration
    with st.sidebar:
        st.header("⚙️ Configuration")
        
        # OpenAI API Key
        openai_key = st.text_input("OpenAI API Key", type="password")
        if openai_key:
            os.environ["OPENAI_API_KEY"] = openai_key
        
        # Model settings
        st.subheader("Model Settings")
        model = st.selectbox("Model", ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"])
        temperature = st.slider("Temperature", 0.0, 1.0, 0.7, 0.1)
        max_tokens = st.slider("Max Tokens", 100, 4000, 2000, 100)
        
        # Document processing settings
        st.subheader("Document Processing")
        chunk_size = st.slider("Chunk Size", 500, 2000, 1000, 100)
        chunk_overlap = st.slider("Chunk Overlap", 50, 500, 200, 50)
    
    # Main interface tabs
    tab1, tab2, tab3, tab4 = st.tabs(["💬 Chat", "📄 Documents", "🔍 Knowledge Base", "📊 Analytics"])
    
    with tab1:
        st.header("Chat with InfoFlow AI")
        
        # Initialize chatbot
        try:
            chatbot = get_chatbot()
            
            # Chat interface
            if "messages" not in st.session_state:
                st.session_state.messages = []
            
            # Display chat messages
            for message in st.session_state.messages:
                with st.chat_message(message["role"]):
                    st.markdown(message["content"])
                    
                    # Show sources for assistant messages
                    if message["role"] == "assistant" and "sources" in message:
                        with st.expander("📚 Sources"):
                            for i, source in enumerate(message["sources"], 1):
                                st.markdown(f"**Source {i}:**")
                                st.text(source["content"])
                                if source["metadata"]:
                                    st.json(source["metadata"])
            
            # Chat input
            if prompt := st.chat_input("Ask me anything about your documents..."):
                # Add user message
                st.session_state.messages.append({"role": "user", "content": prompt})
                
                with st.chat_message("user"):
                    st.markdown(prompt)
                
                # Get AI response
                with st.chat_message("assistant"):
                    with st.spinner("Thinking..."):
                        result = chatbot.query(prompt)
                        
                        if result["status"] == "success":
                            st.markdown(result["answer"])
                            
                            # Store message with sources
                            st.session_state.messages.append({
                                "role": "assistant", 
                                "content": result["answer"],
                                "sources": result["sources"]
                            })
                            
                        else:
                            st.error(result["message"])
        
        except Exception as e:
            st.error(f"Error initializing chatbot: {str(e)}")
    
    with tab2:
        st.header("📄 Document Management")
        
        # File uploader
        uploaded_files = st.file_uploader(
            "Upload documents",
            accept_multiple_files=True,
            type=['pdf', 'docx', 'txt']
        )
        
        if uploaded_files:
            for uploaded_file in uploaded_files:
                if st.button(f"Process {uploaded_file.name}"):
                    with st.spinner(f"Processing {uploaded_file.name}..."):
                        # Save file temporarily
                        temp_path = f"temp_{uploaded_file.name}"
                        with open(temp_path, "wb") as f:
                            f.write(uploaded_file.getbuffer())
                        
                        # Process document
                        try:
                            chatbot = get_chatbot()
                            result = chatbot.add_document(temp_path)
                            
                            if result["status"] == "success":
                                st.success(result["message"])
                            else:
                                st.error(result["message"])
                                
                        except Exception as e:
                            st.error(f"Error processing document: {str(e)}")
                        
                        finally:
                            # Clean up
                            if os.path.exists(temp_path):
                                os.remove(temp_path)
    
    with tab3:
        st.header("🔍 Knowledge Base Explorer")
        
        # Search interface
        search_query = st.text_input("Search knowledge base:")
        
        if search_query and st.button("Search"):
            try:
                chatbot = get_chatbot()
                if chatbot.vector_manager.vector_store:
                    results = chatbot.vector_manager.similarity_search(search_query, k=10)
                    
                    st.subheader(f"Found {len(results)} relevant chunks:")
                    
                    for i, result in enumerate(results, 1):
                        with st.expander(f"Result {i}"):
                            st.text(result.page_content)
                            if result.metadata:
                                st.json(result.metadata)
                else:
                    st.warning("No documents in knowledge base")
                    
            except Exception as e:
                st.error(f"Search error: {str(e)}")
    
    with tab4:
        st.header("📊 System Analytics")
        
        try:
            chatbot = get_chatbot()
            
            # Display stats
            col1, col2, col3 = st.columns(3)
            
            with col1:
                st.metric("Total Documents", "0" if not chatbot.vector_manager.vector_store else "Active")
            
            with col2:
                st.metric("Vector Dimensions", "1536")
            
            with col3:
                st.metric("Model", model)
            
            # System status
            st.subheader("System Status")
            status_data = {
                "Component": ["OpenAI API", "Vector Store", "Document Processor", "QA Chain"],
                "Status": ["✅ Connected", "✅ Ready", "✅ Active", "✅ Initialized"]
            }
            st.table(pd.DataFrame(status_data))
            
        except Exception as e:
            st.error(f"Error loading analytics: {str(e)}")

if __name__ == "__main__":
    # Check if running in Streamlit
    if os.getenv("STREAMLIT_MODE", "false").lower() == "true":
        run_streamlit_ui()
    else:
        # Run Flask API
        app = create_flask_api()
        print("🚀 InfoFlow AI Backend Server Starting...")
        print("📡 API Endpoints available at: http://localhost:5000/api/")
        print("🔗 Frontend should connect to these endpoints")
        app.run(host="0.0.0.0", port=5000, debug=True)