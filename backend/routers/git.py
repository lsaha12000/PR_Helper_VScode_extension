from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from services import git_service

router = APIRouter()


class ValidateRepoRequest(BaseModel):
    path: str


@router.post("/validate")
def validate_repo(body: ValidateRepoRequest):
    valid, error = git_service.validate_repo(body.path)
    return {"valid": valid, "error": error}


@router.get("/branches")
def branches(repo: str = Query(...)):
    try:
        return git_service.get_branches(repo)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/commits")
def commits(
    repo: str = Query(...),
    from_branch: str = Query(..., alias="from"),
    to_branch: str = Query(..., alias="to"),
):
    try:
        return {"commits": git_service.get_commits(repo, from_branch, to_branch)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/diff")
def diff(
    repo: str = Query(...),
    from_branch: str = Query(..., alias="from"),
    to_branch: str = Query(..., alias="to"),
    commits: Optional[str] = Query(None),
):
    try:
        sha_list = commits.split(",") if commits else None
        return {"diff": git_service.get_diff(repo, from_branch, to_branch, sha_list)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
