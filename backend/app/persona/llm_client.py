"""OpenRouter LLM client for writing style analysis (Layer 1)."""

import json

from openai import AsyncOpenAI

from app.config import settings

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key,
        )
    return _client


STYLE_ANALYSIS_PROMPT = """Analyze the following email written by a staff member and extract writing style features.
Return a JSON object with these fields:
- formality_score: float 0-1 (0=very casual, 1=very formal)
- warmth_score: float 0-1 (0=cold/distant, 1=very warm/friendly)
- conciseness_score: float 0-1 (0=very verbose, 1=very concise)
- avg_sentence_length: float (average words per sentence)
- greeting: string (the greeting pattern used, e.g. "Dear", "Hi", "Hello")
- closing: string (the closing pattern used, e.g. "Best regards", "Thanks", "Sincerely")
- tone_keywords: list of 3-5 adjectives describing the tone
- notable_patterns: list of 2-3 notable writing patterns or habits

Only return valid JSON, no other text.

Email:
{email_body}"""

STYLE_AGGREGATION_PROMPT = """Given the following individual style analyses from multiple emails by the same person,
create a unified writing style profile summary.

Individual analyses:
{analyses}

Return a JSON object with:
- formality_score: float 0-1 (averaged/weighted)
- warmth_score: float 0-1 (averaged/weighted)
- conciseness_score: float 0-1 (averaged/weighted)
- avg_sentence_length: float (averaged)
- common_greetings: list of most common greetings
- common_closings: list of most common closings
- style_summary: string (2-3 sentence natural language description of this person's writing style)

Only return valid JSON, no other text."""


async def analyze_email_style(email_body: str) -> dict[str, object]:
    """Analyze a single email's writing style using LLM."""
    client = _get_client()
    response = await client.chat.completions.create(
        model=settings.openrouter_model,
        messages=[
            {"role": "system", "content": "You are a writing style analyst. Return only valid JSON."},
            {"role": "user", "content": STYLE_ANALYSIS_PROMPT.format(email_body=email_body)},
        ],
        temperature=0.3,
        max_tokens=500,
    )
    content = response.choices[0].message.content or "{}"
    # Strip markdown code fences if present
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
    if content.endswith("```"):
        content = content[: content.rfind("```")]
    content = content.strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {"error": "Failed to parse LLM response", "raw": content}


async def aggregate_style_profiles(analyses: list[dict[str, object]]) -> dict[str, object]:
    """Aggregate multiple email style analyses into a unified profile."""
    client = _get_client()
    response = await client.chat.completions.create(
        model=settings.openrouter_model,
        messages=[
            {"role": "system", "content": "You are a writing style analyst. Return only valid JSON."},
            {"role": "user", "content": STYLE_AGGREGATION_PROMPT.format(analyses=json.dumps(analyses, indent=2))},
        ],
        temperature=0.3,
        max_tokens=500,
    )
    content = response.choices[0].message.content or "{}"
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
    if content.endswith("```"):
        content = content[: content.rfind("```")]
    content = content.strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {"error": "Failed to parse LLM response", "raw": content}
