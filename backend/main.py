from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from routers import auth, consultants, aos, matching

app = FastAPI(
    title="G-IT Plateforme Partenaires — POC",
    description="API de matching IA entre consultants et Appels d'Offres",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(consultants.router)
app.include_router(aos.router)
app.include_router(matching.router)


@app.get("/")
def root():
    return {
        "app": "G-IT Plateforme Partenaires POC",
        "version": "0.1.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
