from fastapi import FastAPI, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from routers import auth, consultants, aos, matching

app = FastAPI(
    title="G-IT Plateforme Partenaires — POC",
    description="API de matching IA entre consultants et Appels d'Offres",
    version="0.1.0",
)

ALLOWED_ORIGINS = [
    "https://git-alpha-hazel.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
]

# ── Step 1: CORS middleware (inner layer) ─────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin"],
    max_age=600,
)

# ── Step 2: Manual OPTIONS handler (outer layer — runs FIRST) ─
# Starlette runs the LAST added middleware FIRST.
# This intercepts every preflight and returns 200 immediately,
# before routing or any other handler can produce a 400.
@app.middleware("http")
async def handle_preflight(request: Request, call_next):
    if request.method == "OPTIONS":
        origin = request.headers.get("origin", "")
        allowed = origin if origin in ALLOWED_ORIGINS else ALLOWED_ORIGINS[0]
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin":      allowed,
                "Access-Control-Allow-Methods":     "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                "Access-Control-Allow-Headers":     "Authorization, Content-Type, Accept, Origin",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Max-Age":           "600",
            },
        )
    response = await call_next(request)
    return response

# ── Routers ───────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(consultants.router)
app.include_router(aos.router)
app.include_router(matching.router)

@app.get("/")
def root():
    return {"status": "running", "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "ok"}