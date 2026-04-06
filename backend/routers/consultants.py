from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import Optional
from services.supabase_client import supabase
from services.cv_parser import extract_text_from_pdf
from routers.auth import get_current_user, require_admin
import uuid

router = APIRouter(prefix="/consultants", tags=["consultants"])

ALLOWED_MIME_TYPES = {"application/pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("")
async def create_consultant(
    name: str = Form(...),
    tjm: Optional[int] = Form(None),
    skills: str = Form(...),
    experience_years: Optional[int] = Form(None),
    availability: Optional[str] = Form(None),
    cv_file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    """Create a consultant with CV upload. Available to AO and Admin roles."""
    
    # Validate file
    if cv_file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Seuls les fichiers PDF sont acceptés")

    file_bytes = await cv_file.read()
    
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 10MB)")

    # Extract text from PDF
    try:
        cv_text = extract_text_from_pdf(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Impossible de lire le PDF: {str(e)}")

    if not cv_text or len(cv_text) < 50:
        raise HTTPException(status_code=422, detail="Le PDF semble vide ou illisible")

    # Upload PDF to Supabase Storage
    file_name = f"{uuid.uuid4()}.pdf"
    storage_path = f"cvs/{user['sub']}/{file_name}"

    try:
        supabase.storage.from_("cvs").upload(
            storage_path,
            file_bytes,
            {"content-type": "application/pdf"},
        )
        cv_url = supabase.storage.from_("cvs").get_public_url(storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur upload CV: {str(e)}")

    # Save consultant to database
    try:
        response = supabase.table("consultants").insert({
            "name": name,
            "tjm": tjm,
            "skills": skills,
            "experience_years": experience_years,
            "availability": availability,
            "cv_url": cv_url,
            "cv_text": cv_text,
            "cv_filename": cv_file.filename,
            "created_by": user["sub"],
        }).execute()

        return response.data[0]

    except Exception as e:
        # Cleanup storage on DB error
        try:
            supabase.storage.from_("cvs").remove([storage_path])
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Erreur création consultant: {str(e)}")


@router.get("")
async def list_consultants(user: dict = Depends(get_current_user)):
    """
    Admin sees all consultants.
    AO sees only their own.
    """
    try:
        query = supabase.table("consultants").select(
            "id, name, tjm, skills, experience_years, availability, cv_url, cv_filename, created_at, created_by"
        ).order("created_at", desc=True)

        if user["role"] == "ao":
            query = query.eq("created_by", user["sub"])

        response = query.execute()
        return response.data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{consultant_id}")
async def get_consultant(consultant_id: str, user: dict = Depends(get_current_user)):
    try:
        response = supabase.table("consultants").select("*").eq("id", consultant_id).single().execute()
        consultant = response.data

        # AO can only see their own
        if user["role"] == "ao" and consultant["created_by"] != user["sub"]:
            raise HTTPException(status_code=403, detail="Accès interdit")

        return consultant

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Consultant introuvable")


@router.delete("/{consultant_id}")
async def delete_consultant(consultant_id: str, user: dict = Depends(get_current_user)):
    try:
        consultant = supabase.table("consultants").select("*").eq("id", consultant_id).single().execute().data

        # Only owner or admin can delete
        if user["role"] != "admin" and consultant["created_by"] != user["sub"]:
            raise HTTPException(status_code=403, detail="Accès interdit")

        supabase.table("consultants").delete().eq("id", consultant_id).execute()
        return {"message": "Consultant supprimé"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
