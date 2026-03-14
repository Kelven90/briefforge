import logging
import os

from ..clients.db import execute, fetch_one
from .parse_source import STORAGE_ROOT, _normalize_text

logger = logging.getLogger(__name__)


def _simple_chunk(text: str, max_chars: int = 800, overlap: int = 200) -> list[str]:
  chunks: list[str] = []
  start = 0
  length = len(text)
  while start < length:
    end = min(start + max_chars, length)
    chunk = text[start:end].strip()
    if chunk:
      chunks.append(chunk)
    if end == length:
      break
    start = end - overlap
  return chunks


async def run_chunk_job(job_id: str) -> None:
  """
  Chunk the source into overlapping text segments and insert into public.chunks.
  """
  job = await fetch_one(
    """
    select j.id, j.source_id, j.workspace_id, s.storage_path
    from public.jobs j
    join public.sources s on s.id = j.source_id
    where j.id = %s
    """,
    (job_id,),
  )
  if not job:
    logger.error("chunk job %s not found", job_id)
    return

  storage_path = job["storage_path"]
  full_path = os.path.join(STORAGE_ROOT, storage_path.lstrip("/"))

  try:
    with open(full_path, "r", encoding="utf-8") as f:
      content = f.read()
  except FileNotFoundError:
    logger.exception("Source file not found at %s", full_path)
    return

  normalized = _normalize_text(content)
  segments = _simple_chunk(normalized)

  logger.info("Chunking source %s into %d chunks", job["source_id"], len(segments))

  for idx, segment in enumerate(segments):
    token_count = len(segment.split())
    await execute(
      """
      insert into public.chunks (source_id, workspace_id, chunk_text, chunk_index, token_count)
      values (%s, %s, %s, %s, %s)
      """,
      (job["source_id"], job["workspace_id"], segment, idx, token_count),
    )

