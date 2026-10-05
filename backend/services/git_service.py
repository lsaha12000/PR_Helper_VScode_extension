from pathlib import Path
from typing import Optional
import git as gitlib


def validate_repo(path: str) -> tuple[bool, Optional[str]]:
    try:
        gitlib.Repo(path, search_parent_directories=False)
        return True, None
    except gitlib.InvalidGitRepositoryError:
        return False, "Not a valid git repository"
    except Exception as e:
        return False, str(e)


def get_branches(repo_path: str) -> dict:
    repo = gitlib.Repo(repo_path)
    current = repo.active_branch.name
    local = [b.name for b in repo.branches]
    remote = [r.name for r in repo.remote().refs if not r.name.endswith("/HEAD")]
    return {"current": current, "branches": sorted(set(local + remote))}


def get_commits(repo_path: str, from_branch: str, to_branch: str) -> list[dict]:
    repo = gitlib.Repo(repo_path)
    # commits reachable from from_branch but not from to_branch
    commits = list(repo.iter_commits(f"{to_branch}..{from_branch}"))
    return [
        {
            "sha": c.hexsha[:8],
            "full_sha": c.hexsha,
            "message": c.message.strip().splitlines()[0],
            "author": c.author.name,
            "date": c.committed_datetime.isoformat(),
        }
        for c in commits
    ]


def get_diff(
    repo_path: str,
    from_branch: str,
    to_branch: str,
    commit_shas: Optional[list[str]] = None,
) -> str:
    repo = gitlib.Repo(repo_path)
    if commit_shas:
        # diff spanning the selected commits only
        oldest = commit_shas[-1]
        newest = commit_shas[0]
        diff = repo.git.diff(f"{oldest}^", newest)
    else:
        diff = repo.git.diff(f"{to_branch}...{from_branch}")
    return diff
