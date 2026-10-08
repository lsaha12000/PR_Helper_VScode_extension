from azure.devops.connection import Connection
from azure.devops.v7_0.work.models import TeamContext
from msrest.authentication import BasicAuthentication


def _connection(org_url: str, pat: str) -> Connection:
    creds = BasicAuthentication("", pat)
    return Connection(base_url=org_url, creds=creds)


def validate_pat(org_url: str, pat: str) -> tuple[bool, str | None]:
    try:
        conn = _connection(org_url, pat)
        conn.clients.get_core_client().get_projects()
        return True, None
    except Exception as e:
        return False, str(e)


def get_projects(org_url: str, pat: str) -> list[dict]:
    conn = _connection(org_url, pat)
    projects = conn.clients.get_core_client().get_projects()
    return [{"id": p.id, "name": p.name} for p in projects]


def get_sprints(org_url: str, pat: str, project: str) -> list[dict]:
    conn = _connection(org_url, pat)
    client = conn.clients.get_work_client()
    iterations = client.get_team_iterations(TeamContext(project=project))
    return [
        {"id": it.id, "name": it.name, "path": it.path}
        for it in (iterations or [])
    ]


def search_members(org_url: str, pat: str, project: str, query: str) -> list[dict]:
    conn = _connection(org_url, pat)
    core_client = conn.clients.get_core_client()
    members: list[dict] = []
    seen: set[str] = set()
    q = query.lower()

    def _add(identity) -> None:
        if not identity or identity.id in seen:
            return
        display = identity.display_name or ""
        unique = getattr(identity, "unique_name", "") or ""
        if q and q not in display.lower() and q not in unique.lower():
            return
        seen.add(identity.id)
        members.append({"id": identity.id, "displayName": display, "uniqueName": unique})

    # 1. Try all teams in the project
    try:
        teams = core_client.get_teams(project, top=100) or []
        for team in teams:
            try:
                for m in (core_client.get_team_members_with_team_member_ship(project, team.id, top=200) or []):
                    _add(m.identity)
            except Exception:
                continue
    except Exception:
        pass

    # 2. Fallback: list all project members via identities (handles solo / small projects)
    if not members:
        try:
            import base64, urllib.request, json as _json
            token = base64.b64encode(f":{pat}".encode()).decode()
            url = f"{org_url.rstrip('/')}/_apis/projects/{project}/teams?api-version=7.1&$expandIdentity=true"
            req = urllib.request.Request(url, headers={"Authorization": f"Basic {token}"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = _json.loads(resp.read())
            for team in data.get("value", []):
                for ident in team.get("identities", []):
                    _add(type("I", (), {
                        "id": ident.get("id"),
                        "display_name": ident.get("providerDisplayName", ""),
                        "unique_name": ident.get("uniqueName", ""),
                    })())
        except Exception:
            pass

    # 3. Last resort: include the authenticated user from validate
    if not members:
        try:
            profile = conn.clients.get_profile_client().get_profile("me")
            if profile:
                _add(type("I", (), {
                    "id": profile.id,
                    "display_name": profile.display_name or "",
                    "unique_name": getattr(profile, "email_address", "") or "",
                })())
        except Exception:
            pass

    return members[:50]


def get_work_items(org_url: str, pat: str, project: str, sprint_path: str) -> list[dict]:
    conn = _connection(org_url, pat)
    wit_client = conn.clients.get_work_item_tracking_client()
    wiql = {
        "query": (
            f"SELECT [System.Id],[System.Title],[System.Description],[System.WorkItemType]"
            f" FROM WorkItems"
            f" WHERE [System.TeamProject] = '{project}'"
            f" AND [System.IterationPath] = '{sprint_path}'"
            f" AND [System.WorkItemType] IN ('User Story','Bug','Task')"
            f" ORDER BY [System.Id]"
        )
    }
    result = wit_client.query_by_wiql(wiql)
    if not result.work_items:
        return []
    ids = [wi.id for wi in result.work_items[:50]]
    items = wit_client.get_work_items(ids)
    return [
        {
            "id": i.id,
            "title": i.fields.get("System.Title", ""),
            "description": i.fields.get("System.Description", ""),
            "type": i.fields.get("System.WorkItemType", ""),
            "acceptance_criteria": i.fields.get("System.AcceptanceCriteria", ""),
        }
        for i in items
    ]
