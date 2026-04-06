from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import supabase
from routers.auth import get_current_user, require_admin

router = APIRouter(prefix="/aos", tags=["appels_offres"])


class AOCreate(BaseModel):
    title: str
    description: str
    skills_required: str
    budget_max: Optional[int] = None
    location: Optional[str] = None
    duration: Optional[str] = None
    context: Optional[str] = None


class AOUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    skills_required: Optional[str] = None
    budget_max: Optional[int] = None
    location: Optional[str] = None
    duration: Optional[str] = None
    context: Optional[str] = None
    status: Optional[str] = None  # "open", "closed"


@router.post("")
async def create_ao(body: AOCreate, user: dict = Depends(require_admin)):
    """Create an AO. Admin only."""
    try:
        response = supabase.table("appels_offres").insert({
            "title": body.title,
            "description": body.description,
            "skills_required": body.skills_required,
            "budget_max": body.budget_max,
            "location": body.location,
            "duration": body.duration,
            "context": body.context,
            "status": "open",
            "created_by": user["sub"],
        }).execute()

        return response.data[0]

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def list_aos(user: dict = Depends(get_current_user)):
    """All users can see AOs."""
    try:
        response = supabase.table("appels_offres").select(
            "*, profiles(name)"
        ).order("created_at", desc=True).execute()
        return response.data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{ao_id}")
async def get_ao(ao_id: str, user: dict = Depends(get_current_user)):
    try:
        response = supabase.table("appels_offres").select("*, profiles(name)").eq("id", ao_id).single().execute()
        return response.data
    except Exception:
        raise HTTPException(status_code=404, detail="AO introuvable")


@router.patch("/{ao_id}")
async def update_ao(ao_id: str, body: AOUpdate, user: dict = Depends(require_admin)):
    try:
        update_data = body.model_dump(exclude_none=True)
        response = supabase.table("appels_offres").update(update_data).eq("id", ao_id).execute()
        return response.data[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{ao_id}")
async def delete_ao(ao_id: str, user: dict = Depends(require_admin)):
    try:
        supabase.table("appels_offres").delete().eq("id", ao_id).execute()
        return {"message": "AO supprimé"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
