from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from services.supabase_client import supabase
from services.ai_matching import score_consultants_batch
from routers.auth import get_current_user, require_admin

router = APIRouter(prefix="/matching", tags=["matching"])


class MatchRequest(BaseModel):
    ao_id: str
    top_n: int = 3  # Return top N results


@router.post("/run")
async def run_matching(body: MatchRequest, user: dict = Depends(require_admin)):
    """
    Trigger AI matching for an AO against all consultants.
    Returns top N scored consultants with explanations.
    Admin only.
    """
    # Fetch AO
    try:
        ao_response = supabase.table("appels_offres").select("*").eq("id", body.ao_id).single().execute()
        ao = ao_response.data
    except Exception:
        raise HTTPException(status_code=404, detail="AO introuvable")

    # Fetch all consultants with CV text
    try:
        consultants_response = supabase.table("consultants").select(
            "id, name, tjm, skills, experience_years, cv_text"
        ).execute()
        consultants = consultants_response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur récupération consultants: {str(e)}")

    if not consultants:
        raise HTTPException(status_code=404, detail="Aucun consultant disponible pour le matching")

    # Filter out consultants without CV text
    valid_consultants = [c for c in consultants if c.get("cv_text")]
    if not valid_consultants:
        raise HTTPException(status_code=422, detail="Aucun consultant avec un CV lisible")

    # Run AI scoring
    try:
        all_scores = await score_consultants_batch(ao, valid_consultants)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # Take top N
    top_results = all_scores[:body.top_n]

    # Save results to database
    try:
        # Clear previous matching for this AO
        supabase.table("matchings").delete().eq("ao_id", body.ao_id).execute()

        # Insert new results
        for rank, result in enumerate(top_results, start=1):
            supabase.table("matchings").insert({
                "ao_id": body.ao_id,
                "consultant_id": result["consultant_id"],
                "score_total": result["score_total"],
                "breakdown": result["breakdown"],
                "points_forts": result["points_forts"],
                "points_faibles": result["points_faibles"],
                "resume_matching": result["resume_matching"],
                "recommandation": result["recommandation"],
                "rank": rank,
                "ran_by": user["sub"],
            }).execute()

    except Exception as e:
        # Don't fail the response if save fails — return results anyway
        print(f"Warning: Could not save matching results: {e}")

    return {
        "ao_id": body.ao_id,
        "ao_title": ao["title"],
        "total_consultants_evaluated": len(valid_consultants),
        "top_n": body.top_n,
        "results": top_results,
    }


@router.get("/results/{ao_id}")
async def get_matching_results(ao_id: str, user: dict = Depends(require_admin)):
    """Get stored matching results for an AO."""
    try:
        response = supabase.table("matchings").select(
            "*, consultants(name, tjm, skills, cv_url)"
        ).eq("ao_id", ao_id).order("rank").execute()

        return {
            "ao_id": ao_id,
            "results": response.data,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
