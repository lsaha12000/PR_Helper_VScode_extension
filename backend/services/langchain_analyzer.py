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
