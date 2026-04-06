from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from jose import jwt, JWTError
from datetime import datetime, timedelta
from services.supabase_client import supabase
from config import settings

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str  # "admin" or "ao"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


def create_token(user_id: str, email: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    return decode_token(credentials.credentials)


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    return user


async def require_ao(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("ao", "admin"):
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    return user


@router.post("/register")
async def register(body: RegisterRequest):
    if body.role not in ("admin", "ao"):
        raise HTTPException(status_code=400, detail="Rôle invalide. Utilisez 'admin' ou 'ao'")

    try:
        # Create user in Supabase Auth
        auth_response = supabase.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
        })

        user_id = auth_response.user.id

        # Store profile in profiles table
        supabase.table("profiles").insert({
            "id": user_id,
            "email": body.email,
            "name": body.name,
            "role": body.role,
        }).execute()

        token = create_token(user_id, body.email, body.role)

        return {
            "token": token,
            "user": {
                "id": user_id,
                "email": body.email,
                "name": body.name,
                "role": body.role,
            }
        }

    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg or "already been registered" in error_msg:
            raise HTTPException(status_code=409, detail="Cet email est déjà utilisé")
        raise HTTPException(status_code=400, detail=f"Erreur d'inscription: {error_msg}")


@router.post("/login")
async def login(body: LoginRequest):
    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })

        user_id = auth_response.user.id

        # Get profile
        profile_response = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
        profile = profile_response.data

        token = create_token(user_id, body.email, profile["role"])

        return {
            "token": token,
            "user": {
                "id": user_id,
                "email": body.email,
                "name": profile["name"],
                "role": profile["role"],
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    try:
        profile = supabase.table("profiles").select("*").eq("id", user["sub"]).single().execute()
        return profile.data
    except Exception:
        raise HTTPException(status_code=404, detail="Profil introuvable")
