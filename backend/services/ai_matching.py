import json
import asyncio
from typing import Optional
from openai import AsyncOpenAI
from config import settings

client = AsyncOpenAI(api_key=settings.openai_api_key)


SCORING_SYSTEM_PROMPT = """Tu es un expert en recrutement IT et consulting, spécialisé dans l'évaluation de profils techniques.

Ton rôle : analyser des CVs de consultants et les scorer par rapport à un Appel d'Offres (AO).

Tu dois retourner UNIQUEMENT un JSON valide, sans markdown, sans texte avant ou après.

Critères de scoring (total 100 points) :
- competences_techniques (40 pts max) : match entre les compétences requises et celles du consultant
- seniorite (20 pts max) : niveau d'expérience et années dans le domaine
- contexte_domaine (20 pts max) : familiarité avec le secteur/contexte métier de l'AO
- compatibilite_tjm (20 pts max) : TJM du consultant vs budget de l'AO (si fournis)

Format de réponse requis :
{
  "consultants": [
    {
      "consultant_id": "...",
      "score_total": 87,
      "breakdown": {
        "competences_techniques": 36,
        "seniorite": 18,
        "contexte_domaine": 16,
        "compatibilite_tjm": 17
      },
      "points_forts": ["point 1", "point 2", "point 3"],
      "points_faibles": ["point 1"],
      "resume_matching": "Explication concise en 2-3 phrases de pourquoi ce profil correspond (ou pas) à l'AO.",
      "recommandation": "FORT" | "MOYEN" | "FAIBLE"
    }
  ]
}
"""


def build_matching_prompt(ao: dict, consultants: list[dict]) -> str:
    """Build the user prompt for matching."""
    
    # Format AO
    ao_section = f"""=== APPEL D'OFFRES ===
Titre : {ao.get('title', 'N/A')}
Description : {ao.get('description', 'N/A')}
Compétences requises : {ao.get('skills_required', 'N/A')}
Budget / TJM max : {ao.get('budget_max', 'Non précisé')} €/jour
Localisation : {ao.get('location', 'Non précisée')}
Durée : {ao.get('duration', 'Non précisée')}
Contexte supplémentaire : {ao.get('context', '')}
"""

    # Format each consultant
    consultants_section = "\n\n".join([
        f"""=== CONSULTANT {i+1} (ID: {c['id']}) ===
Nom : {c.get('name', 'N/A')}
TJM demandé : {c.get('tjm', 'Non précisé')} €/jour
Compétences déclarées : {c.get('skills', 'N/A')}
Années d'expérience : {c.get('experience_years', 'Non précisé')}

CONTENU DU CV :
{c.get('cv_text', 'CV non disponible')[:3000]}
{"[CV tronqué pour la longueur]" if len(c.get('cv_text', '')) > 3000 else ""}
"""
        for i, c in enumerate(consultants)
    ])

    return f"""{ao_section}

{consultants_section}

---
Analyse chaque consultant par rapport à cet AO et retourne le JSON de scoring.
Les IDs des consultants dans ta réponse doivent correspondre exactement aux IDs fournis.
Score les {len(consultants)} consultant(s) fourni(s).
"""


async def score_consultants(ao: dict, consultants: list[dict]) -> list[dict]:
    """
    Core AI matching function.
    Uses GPT-4o with structured JSON output for reliable, explainable scoring.
    
    Strategy:
    1. Send AO + all CVs texts in a single prompt
    2. GPT-4o scores each consultant with breakdown + explanation
    3. Sort by total score, return top results
    """
    if not consultants:
        return []

    prompt = build_matching_prompt(ao, consultants)

    try:
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SCORING_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,  # Low temp for consistent scoring
            max_tokens=4000,
        )

        content = response.choices[0].message.content
        result = json.loads(content)
        scored = result.get("consultants", [])

        # Sort by total score descending
        scored.sort(key=lambda x: x.get("score_total", 0), reverse=True)

        # Enrich with consultant metadata
        consultant_map = {str(c["id"]): c for c in consultants}
        for item in scored:
            cid = str(item.get("consultant_id", ""))
            if cid in consultant_map:
                c = consultant_map[cid]
                item["consultant_name"] = c.get("name", "Inconnu")
                item["consultant_tjm"] = c.get("tjm")
                item["consultant_skills"] = c.get("skills", "")

        return scored

    except json.JSONDecodeError as e:
        raise ValueError(f"GPT response parsing error: {e}")
    except Exception as e:
        raise RuntimeError(f"OpenAI API error: {e}")


async def score_consultants_batch(ao: dict, consultants: list[dict], batch_size: int = 5) -> list[dict]:
    """
    Handle large number of consultants by batching.
    GPT-4o context window allows ~10 CVs at once safely.
    For more, we batch and merge results.
    """
    if len(consultants) <= batch_size:
        return await score_consultants(ao, consultants)

    # Process in batches
    batches = [consultants[i:i+batch_size] for i in range(0, len(consultants), batch_size)]
    all_results = []

    tasks = [score_consultants(ao, batch) for batch in batches]
    batch_results = await asyncio.gather(*tasks)

    for results in batch_results:
        all_results.extend(results)

    # Re-sort globally after merging
    all_results.sort(key=lambda x: x.get("score_total", 0), reverse=True)

    return all_results
