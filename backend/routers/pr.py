from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from azure.devops.connection import Connection
from azure.devops.v7_1.git.models import GitPullRequest, GitPullRequestCompletionOptions
from msrest.authentication import BasicAuthentication

router = APIRouter()


class CreatePRRequest(BaseModel):
    org_url: str
    pat: str
    project: str
    repo_name: str
    title: str
    description: str
    source_branch: str
    target_branch: str


@router.post("/create")
def create_pr(body: CreatePRRequest):
    try:
        creds = BasicAuthentication("", body.pat)
        conn = Connection(base_url=body.org_url, creds=creds)
        git_client = conn.clients.get_git_client()

        repos = git_client.get_repositories(body.project)
        repo = next((r for r in repos if r.name == body.repo_name), None)
        if repo is None:
            raise HTTPException(status_code=404, detail=f"Repository '{body.repo_name}' not found in project '{body.project}'")

        pr = GitPullRequest(
            title=body.title,
            description=body.description,
            source_ref_name=f"refs/heads/{body.source_branch}",
            target_ref_name=f"refs/heads/{body.target_branch}",
        )
        result = git_client.create_pull_request(pr, repo.id, body.project)
        pr_url = f"{body.org_url}/{body.project}/_git/{body.repo_name}/pullrequest/{result.pull_request_id}"
        return {"pr_id": result.pull_request_id, "pr_url": pr_url}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
