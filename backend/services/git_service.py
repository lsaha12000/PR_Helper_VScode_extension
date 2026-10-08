from pathlib import Path
from typing import Optional
import re
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


def get_ado_remote_info(repo_path: str) -> dict:
    """Parse org_url, project, and repo_name from the ADO remote URL."""
    repo = gitlib.Repo(repo_path)
    try:
        remote_url = repo.remote("origin").url
    except Exception:
        return {"org_url": None, "project": None, "repo_name": None}

    # HTTPS: https://dev.azure.com/{org}/{project}/_git/{repo}
    # or:    https://{org}.visualstudio.com/{project}/_git/{repo}
    m = re.match(
        r"https://dev\.azure\.com/([^/]+)/([^/]+)/_git/([^/]+?)(?:\.git)?$",
        remote_url,
    )
    if m:
        org, project, repo_name = m.group(1), m.group(2), m.group(3)
        return {
            "org_url": f"https://dev.azure.com/{org}",
            "project": project,
            "repo_name": repo_name,
        }

    m = re.match(
        r"https://([^.]+)\.visualstudio\.com/([^/]+)/_git/([^/]+?)(?:\.git)?$",
        remote_url,
    )
    if m:
        org, project, repo_name = m.group(1), m.group(2), m.group(3)
        return {
            "org_url": f"https://dev.azure.com/{org}",
            "project": project,
            "repo_name": repo_name,
        }

    # SSH: git@ssh.dev.azure.com:v3/{org}/{project}/{repo}
    m = re.match(r"git@ssh\.dev\.azure\.com:v3/([^/]+)/([^/]+)/([^/]+?)(?:\.git)?$", remote_url)
    if m:
        org, project, repo_name = m.group(1), m.group(2), m.group(3)
        return {
            "org_url": f"https://dev.azure.com/{org}",
            "project": project,
            "repo_name": repo_name,
        }

    return {"org_url": None, "project": None, "repo_name": None}


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
