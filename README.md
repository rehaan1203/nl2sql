# NL2SQL - Natural Language to SQL Generator

**Query your database using plain English. Powered by Mistral AI + LangChain.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-blue)](https://fastapi.tiangolo.com/)
[![LangChain](https://img.shields.io/badge/LangChain-0.3-green)](https://www.langchain.com/)
[![Mistral](https://img.shields.io/badge/Mistral-AI-purple)](https://mistral.ai/)

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/nl2sql-generator.git
cd nl2sql-generator

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
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

### Advanced Features
- 🎯 **Table-Aware Context**: Automatically detects which table you're querying
- 🔄 **Session Isolation**: Each user has isolated database context
- 💾 **Redis Caching**: Fast response times with intelligent caching
- 📈 **Token Optimization**: Efficient token usage (<500 tokens per request)
- 🛡️ **Hallucination Prevention**: Validates tables and columns before execution

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
- **Framer Motion** - Animation library
- **Chart.js** - Data visualization
- **Lucide React** - Icon library

### Backend
- **FastAPI** - Modern Python web framework
- **LangChain** - LLM framework with SQL toolkit
- **Mistral AI** - LLM provider
- **ChromaDB** - Vector store for semantic search
- **Redis** - Caching and session management
- **SQLite** - Database engine

## 📚 API Documentation

See [docs/API.md](docs/API.md) for full API reference.

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MISTRAL_API_KEY` | Mistral API key | Required |
| `DATABASE_URL` | SQLite database URL | `sqlite:///./nl2sql.db` |
| `AI_MODEL` | Mistral model to use | `mistral-large-3` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
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
