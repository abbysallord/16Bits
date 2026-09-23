from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import router as api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="High-velocity hackathon API powered by FastAPI and Groq",
    version="1.0.0",
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Open for rapid hackathon prototyping
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(api_router)

@app.get("/")
def root():
    return {
        "message": "Welcome to 16Bits Hackathon API",
        "docs": "/docs",
        "health": "/api/health"
    }
