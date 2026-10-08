import json
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

SYSTEM_PROMPT = (
    "You are a senior code reviewer. You are given a git diff and a list of user stories "
    "with acceptance criteria.\n"
    "Your task is to determine whether the code changes satisfy each user story.\n"
    "Respond ONLY with a valid JSON array — no markdown, no explanation outside the JSON.\n"
    'Each element must be: { "storyId": number, "status": "PASS"|"PARTIAL"|"FAIL", '
    '"evidence": "quote or reference from diff", "gaps": "what is missing or empty string if none" }'
)

PR_CONTENT_PROMPT = (
    "You are a senior software engineer writing a pull request for an Azure DevOps repository.\n"
    "Given a git diff, user stories, and their compliance analysis results, generate:\n"
    "1. A concise professional PR title (one line, under 80 characters)\n"
    "2. A detailed Markdown PR description covering: summary of changes, stories addressed, "
    "analysis results, and any known gaps\n"
    "3. A reviewer comment highlighting key areas to focus on, risks, and open questions\n"
    "Respond ONLY with a valid JSON object — no markdown, no explanation outside the JSON.\n"
    'Format: { "title": "...", "description": "...(markdown)...", "comment": "..." }'
)


def analyze_with_langchain(
    diff: str,
    stories: list[dict],
    api_key: str,
    base_url: str = "https://api.openai.com/v1",
    model: str = "gpt-4o",
) -> list[dict]:
    llm = ChatOpenAI(
        api_key=api_key,
        base_url=base_url.rstrip("/"),
        model=model,
        temperature=0,
    )

    stories_text = "\n\n".join(
        f"[ID:{s['id']}] {s.get('type', 'User Story')}: {s['title']}\n"
        f"Description: {s.get('description') or 'N/A'}\n"
        f"Acceptance Criteria: {s.get('acceptance_criteria') or 'N/A'}"
        for s in stories
    )
    user_content = (
        f"## User Stories\n\n{stories_text}\n\n"
        f"## Git Diff\n```diff\n{diff[:30_000]}\n```"
    )

    response = llm.invoke([
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ])

    parsed = json.loads(response.content)
    if isinstance(parsed, list):
        return parsed
    for v in parsed.values():
        if isinstance(v, list):
            return v
    return list(parsed.values())


def generate_pr_content(
    diff: str,
    stories: list[dict],
    analysis: list[dict],
    api_key: str,
    base_url: str = "https://api.openai.com/v1",
    model: str = "gpt-4o",
) -> dict:
    llm = ChatOpenAI(
        api_key=api_key,
        base_url=base_url.rstrip("/"),
        model=model,
        temperature=0,
    )

    analysis_map = {a["storyId"]: a for a in analysis}
    stories_text = "\n\n".join(
        f"[ID:{s['id']}] {s.get('type', 'User Story')}: {s['title']}\n"
        f"Status: {analysis_map.get(s['id'], {}).get('status', 'N/A')}\n"
        f"Gaps: {analysis_map.get(s['id'], {}).get('gaps', '') or 'None'}"
        for s in stories
    )
    user_content = (
        f"## Stories & Analysis\n\n{stories_text}\n\n"
        f"## Git Diff\n```diff\n{diff[:25_000]}\n```"
    )

    response = llm.invoke([
        SystemMessage(content=PR_CONTENT_PROMPT),
        HumanMessage(content=user_content),
    ])

    raw = response.content.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(raw)
