from azure.devops.connection import Connection
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
    iterations = client.get_team_iterations(project, project)
    return [
        {"id": it.id, "name": it.name, "path": it.path}
        for it in (iterations or [])
    ]


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
    result = wit_client.query_by_wiql(wiql, project=project)
    if not result.work_items:
        return []
    ids = [wi.id for wi in result.work_items[:50]]
    items = wit_client.get_work_items(
        ids,
        fields=["System.Id", "System.Title", "System.Description", "System.WorkItemType", "System.AcceptanceCriteria"],
    )
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
