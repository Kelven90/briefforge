import logging
import os
from typing import Any

from openai import AsyncOpenAI

from ..clients.db import execute, fetch_all, fetch_one


logger = logging.getLogger(__name__)


def _is_llm_disabled() -> bool:
  return os.getenv("BRIEFFORGE_DISABLE_LLM") == "1"


OPENAI_API_KEY: str | None = None


def _get_client() -> AsyncOpenAI:
  global OPENAI_API_KEY

  if _is_llm_disabled():
    raise RuntimeError("LLM is disabled; embeddings should not be requested")

  from os import getenv

  if OPENAI_API_KEY is None:
    OPENAI_API_KEY = getenv("OPENAI_API_KEY")
  if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set for indexing worker")
  return AsyncOpenAI(api_key=OPENAI_API_KEY)


async def _fetch_chunks_needing_embeddings(source_id: str) -> list[dict[str, Any]]:
  rows = await fetch_all(
    """
    select id, chunk_text
    from public.chunks
    where source_id = %s and embedding is null
    order by chunk_index
    """,
    (source_id,),
  )
  return rows


async def run_embed_job(job_id: str) -> None:
  """
  Embed all chunks for the given source that are missing embeddings.
  If BRIEFFORGE_DISABLE_LLM=1, this becomes a no-op to avoid costs.
  """
  if _is_llm_disabled():
    logger.info("LLM disabled; skipping embed job %s", job_id)
    return

  job = await fetch_one(
    """
    select j.id, j.source_id
    from public.jobs j
    where j.id = %s
    """,
    (job_id,),
  )
  if not job:
    logger.error("embed job %s not found", job_id)
    return

  source_id = job["source_id"]
  chunks = await _fetch_chunks_needing_embeddings(source_id)
  if not chunks:
    logger.info("No chunks needing embeddings for source %s", source_id)
    return

  client = _get_client()
  texts = [c["chunk_text"] for c in chunks]

  logger.info("Embedding %d chunks for source %s", len(texts), source_id)

  resp = await client.embeddings.create(
    model="text-embedding-3-small",
    input=texts,
  )

  vectors = [d.embedding for d in resp.data]

  # Update each chunk
  for chunk, vector in zip(chunks, vectors):
    await execute(
      "update public.chunks set embedding = %s where id = %s",
      (vector, chunk["id"]),
    )

