from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from services import ado_service

router = APIRouter()


class AdoValidateRequest(BaseModel):
    org_url: str
    pat: str


@router.post("/validate")
def validate(body: AdoValidateRequest):
    valid, error = ado_service.validate_pat(body.org_url, body.pat)
    return {"valid": valid, "error": error}


@router.get("/projects")
def projects(org_url: str = Query(...), pat: str = Query(...)):
    try:
        return {"projects": ado_service.get_projects(org_url, pat)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/sprints")
def sprints(
    org_url: str = Query(...),
    pat: str = Query(...),
    project: str = Query(...),
):
    try:
        return {"sprints": ado_service.get_sprints(org_url, pat, project)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/members")
def members(
    org_url: str = Query(...),
    pat: str = Query(...),
    project: str = Query(...),
    query: str = Query(""),
):
    try:
        return {"members": ado_service.search_members(org_url, pat, project, query)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/work-items")
def work_items(
    org_url: str = Query(...),
    pat: str = Query(...),
    project: str = Query(...),
    sprint_path: str = Query(...),
):
    try:
        return {"items": ado_service.get_work_items(org_url, pat, project, sprint_path)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
