# NL2SQL - Natural Language to SQL Generator

**Query your database using plain English. Powered by Mistral AI + LangChain.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-blue)](https://fastapi.tiangolo.com/)
[![LangChain](https://img.shields.io/badge/LangChain-0.3-green)](https://www.langchain.com/)
[![Gemini / OpenAI](https://img.shields.io/badge/Models-Gemini%20%7C%20OpenAI-purple)]()

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/nl2sql-generator.git
cd nl2sql-generator

# Backend setup
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd backend
cp .env.example .env
# Edit .env with your API keys
uvicorn main:app --reload

# Frontend setup (in new terminal)
cd frontend
npm install
npm run dev

# Open browser at http://localhost:3000
```

## ✨ Features

### Core Features
- 🗣️ **Natural Language to SQL**: Ask questions in plain English, get SQL results
- 🤖 **AI-Powered**: Uses Mistral AI for SQL generation
- 📊 **Rich Visualizations**: See results as tables, charts, or raw SQL
- 📁 **Upload Your Own Database**: Bring your own SQLite database
- 🔒 **Secure**: Read-only queries, SQL injection protection
- 🖼️ **Exportable Results**: Export your data visualizations and tables as images instantly
- 🧩 **Enhanced UI**: Modern, accessible interface powered by Radix UI and Framer Motion

### Advanced Features
- 🎯 **Table-Aware Context**: Automatically detects which table you're querying
- 🔄 **Session Isolation**: Each user has isolated database context
- 💾 **Redis Caching**: Fast response times with intelligent caching
- 📈 **Token Optimization**: Efficient token usage (<500 tokens per request)
- 🛡️ **Hallucination Prevention**: Validates tables and columns before execution
- 🧠 **Local Semantic Search**: Uses Hugging Face embeddings for free, accurate schema matching without API costs

## 🏗️ Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   User      │───▶│   Next.js   │───▶│   FastAPI   │───▶│   LangChain │
│  Interface  │    │  Frontend   │    │   Backend   │    │    Agent    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                │
                                                                ▼
                                                          ┌─────────────┐
                                                          │  Mistral AI │
                                                          │    Model    │
                                                          └─────────────┘
```

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible unstyled component primitives
- **Framer Motion** - Animation library
- **Chart.js** & **Recharts** - Data visualization
- **html2canvas** - Export functionality
- **Lucide React** - Icon library

### Backend
- **FastAPI** - Modern Python web framework
- **LangChain** - LLM framework with SQL toolkit
- **Mistral AI** - LLM provider
- **Hugging Face Embeddings** - Local embedding generation (`all-MiniLM-L6-v2`)
- **ChromaDB** - Vector store for semantic search
- **Redis** - Caching and session management
- **SQLite** - Database engine

## 📚 API Documentation

See [docs/API.md](docs/API.md) for full API reference.

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_API_KEY` | Google API key for Gemini models | Required if using Gemini |
| `OPENAI_API_KEY` | OpenAI API key | Required if using OpenAI |
| `DATABASE_URL` | Primary database URL (PostgreSQL) | `postgresql://.../nl2sql` |
| `DEFAULT_DATABASE_URL` | Fallback SQLite database URL | `sqlite:///./database/nl2sql.db` |
| `AI_MODEL` | LLM model to use | `gemini-2.0-flash-exp` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:3000` |
| `MAX_FILE_SIZE_MB` | Max upload size | `50` |
| `QUERY_TIMEOUT_SECONDS` | Query timeout | `5` |

## 🧪 Testing

```bash
# Backend tests
cd backend
python tests/run_tests.py

# Frontend tests
cd frontend
npm test
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Mistral AI](https://mistral.ai/) for the excellent API
- [LangChain](https://www.langchain.com/) for the SQL agent framework
- [Vercel](https://vercel.com/) for frontend hosting

## 📞 Support

- Issues: [GitHub Issues](https://github.com/yourusername/nl2sql-generator/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/nl2sql-generator/discussions)
