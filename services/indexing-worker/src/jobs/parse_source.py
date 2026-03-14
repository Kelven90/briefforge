import logging
import os

from ..clients.db import execute, fetch_one


logger = logging.getLogger(__name__)


STORAGE_ROOT = os.getenv("STORAGE_ROOT", "./storage")


async def run_parse_job(job_id: str) -> None:
  """
  Parse the raw source file into normalized text.

  For the MVP we assume text-like inputs and:
  - read the file from STORAGE_ROOT + storage_path
  - store a best-effort normalized text back into sources.status and log size

  Later we can persist parsed artifacts in a separate table or object storage.
  """
  job = await fetch_one(
    """
    select j.id, j.source_id, s.storage_path
    from public.jobs j
    join public.sources s on s.id = j.source_id
    where j.id = %s
    """,
    (job_id,),
  )
  if not job:
    logger.error("parse job %s not found", job_id)
    return

  storage_path = job["storage_path"]
  full_path = os.path.join(STORAGE_ROOT, storage_path.lstrip("/"))

  try:
    with open(full_path, "r", encoding="utf-8") as f:
      content = f.read()
  except FileNotFoundError:
    logger.exception("Source file not found at %s", full_path)
    await execute(
      "update public.sources set status = 'failed' where id = %s",
      (job["source_id"],),
    )
    return

  normalized = _normalize_text(content)
  logger.info("Parsed source %s (%d chars)", job["source_id"], len(normalized))

  # For now we just mark the source as parsing complete; chunks/embeds handle the rest.
  await execute(
    "update public.sources set status = 'parsing' where id = %s",
    (job["source_id"],),
  )


def _normalize_text(raw: str) -> str:
  # Extremely simple normalization for MVP.
  return "\n".join(line.strip() for line in raw.splitlines() if line.strip())

