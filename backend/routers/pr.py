from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from azure.devops.connection import Connection
from azure.devops.v7_1.git.models import (
    GitPullRequest,
    GitPullRequestCommentThread,
    Comment,
    IdentityRefWithVote,
    WebApiTagDefinition,
    ResourceRef,
)
from msrest.authentication import BasicAuthentication

router = APIRouter()


class ReviewerItem(BaseModel):
    id: str
    displayName: str = ""
    uniqueName: str = ""


class CreatePRRequest(BaseModel):
    org_url: str
    pat: str
    project: str
    repo_name: str
    title: str
    description: str
    source_branch: str
    target_branch: str
    reviewers: list[ReviewerItem] = []
    labels: list[str] = []
    work_item_ids: list[int] = []
    is_draft: bool = False
    initial_comment: str = ""


@router.post("/create")
def create_pr(body: CreatePRRequest):
    try:
        creds = BasicAuthentication("", body.pat)
        conn = Connection(base_url=body.org_url, creds=creds)
        git_client = conn.clients.get_git_client()

        repos = git_client.get_repositories(body.project)
        repo = next((r for r in repos if r.name == body.repo_name), None)
        if repo is None:
            raise HTTPException(
                status_code=404,
                detail=f"Repository '{body.repo_name}' not found in project '{body.project}'",
            )

        pr = GitPullRequest(
            title=body.title,
            description=body.description,
            source_ref_name=f"refs/heads/{body.source_branch}",
            target_ref_name=f"refs/heads/{body.target_branch}",
            is_draft=body.is_draft,
            reviewers=[IdentityRefWithVote(id=r.id) for r in body.reviewers] or None,
            labels=[WebApiTagDefinition(name=lbl) for lbl in body.labels] or None,
            work_item_refs=[ResourceRef(id=str(wi_id)) for wi_id in body.work_item_ids] or None,
        )
        result = git_client.create_pull_request(pr, repo.id, body.project)

        if body.initial_comment.strip():
            thread = GitPullRequestCommentThread(
                comments=[Comment(content=body.initial_comment, comment_type=1)],
                status=1,
            )
            git_client.create_thread(thread, repo.id, result.pull_request_id, body.project)

        pr_url = f"{body.org_url}/{body.project}/_git/{body.repo_name}/pullrequest/{result.pull_request_id}"
        return {"pr_id": result.pull_request_id, "pr_url": pr_url}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
