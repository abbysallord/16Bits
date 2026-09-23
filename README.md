# 16Bits - Hackathon Master Monorepo 🚀

A high-velocity, production-grade starter scaffold engineered for 8-24 hour competitive hackathons.

## Architecture

- **`frontend/`**: Vite + React 18/19 (TypeScript) + Tailwind CSS + Lucide Icons + Neobrutalism/Retro styling hooks + Pre-wired API client.
- **`backend/`**: FastAPI (Python 3.10+) + Groq LLM client (`llama-3.3-70b-versatile`) + CORS middleware + Streaming SSE + Structured Pydantic validation.
- **`presentation/`**: Slidev developer pitch deck with pre-structured judging presentation (`slides.md`).

---

## Quickstart Guide

### 1. Backend Setup
```bash
cd backend
# Create virtual environment
uv venv .venv
source .venv/bin/activate
# Install dependencies
uv pip install -r requirements.txt
# Copy environment configuration
cp .env.example .env
# Start the FastAPI server (Hot-reload enabled on port 8000)
uvicorn app.main:app --reload --port 8000
```
Backend will be live at `http://localhost:8000` with interactive API docs at `http://localhost:8000/docs`.

### 2. Frontend Setup
```bash
cd frontend
# Install dependencies
npm install
# Start Vite development server (port 5173)
npm run dev
```
Frontend will be live at `http://localhost:5173`.

### 3. Presentation Pitch Deck
```bash
cd presentation
npm install
npm run dev
```
Slides will be live at `http://localhost:3030`.

---

## Hackathon Team Roster & Roles
- **Teammate 1 (Lead Developer / Dhanush)**: Core Architecture, Agentic AI pipeline, Backend API, and Frontend Integration.
- **Teammate 2 (Full-Stack / UI Specialist)**: User flows, component design, responsive styling, and feature expansion.
- **Teammate 3 (Pitch / Product Lead)**: Slidev pitch presentation, user story definition, demo rehearsal, and value proposition.
