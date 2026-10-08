from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.langchain_analyzer import analyze_with_langchain, generate_pr_content

router = APIRouter(tags=["analyze"])


class Story(BaseModel):
    id: int
    type: str = "User Story"
    title: str
    description: str | None = None
    acceptance_criteria: str | None = None


class AnalyzeRequest(BaseModel):
    diff: str
    stories: list[Story]
    api_key: str
    base_url: str = "https://api.openai.com/v1"
    model: str = "gpt-4o"


@router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    try:
        results = analyze_with_langchain(
            diff=req.diff,
            stories=[s.model_dump() for s in req.stories],
            api_key=req.api_key,
            base_url=req.base_url,
            model=req.model,
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class GeneratePRContentRequest(BaseModel):
    diff: str
    stories: list[Story]
    analysis: list[dict]
    api_key: str
    base_url: str = "https://api.openai.com/v1"
    model: str = "gpt-4o"


@router.post("/analyze/pr-content")
async def generate_pr_content_endpoint(req: GeneratePRContentRequest):
    try:
        result = generate_pr_content(
            diff=req.diff,
            stories=[s.model_dump() for s in req.stories],
            analysis=req.analysis,
            api_key=req.api_key,
            base_url=req.base_url,
            model=req.model,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
