#!/bin/bash
# Start InfoFlow AI Streamlit Interface

echo "🚀 Starting InfoFlow AI Streamlit Interface..."
echo "📋 Make sure you have set your OPENAI_API_KEY environment variable"
echo ""

cd backend
export STREAMLIT_MODE=true
streamlit run app.py --server.port 8501 --server.address 0.0.0.0