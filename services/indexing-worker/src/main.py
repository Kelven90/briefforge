import asyncio
import os
import logging
import sys

from dotenv import load_dotenv

from .clients.db import execute, get_connection
from .jobs.parse_source import run_parse_job
from .jobs.chunk_source import run_chunk_job
from .jobs.embed_chunks import run_embed_job
from .models.schemas import JobType


logger = logging.getLogger(__name__)

def configure_event_loop() -> None:
  """
  Psycopg async is not compatible with ProactorEventLoop on Windows.
  Force SelectorEventLoopPolicy when running on win32.
  """
  if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())  # type: ignore[attr-defined]


def configure_logging() -> None:
  level = os.getenv("LOG_LEVEL", "INFO").upper()
  logging.basicConfig(
    level=level,
    format="%(asctime)s | worker | %(levelname)s | %(message)s",
  )


async def _claim_next_job() -> dict | None:
  """
  Claim the next queued job in Postgres by marking it running and incrementing attempts.
  This keeps the system robust even if Redis/BullMQ is temporarily unavailable.
  """
  # Note: in a more advanced setup we'd leverage SKIP LOCKED for concurrent workers.
  async with get_connection() as conn:
    async with conn.cursor() as cur:
      await cur.execute(
        """
        update public.jobs
        set status = 'running',
            attempts = attempts + 1,
            started_at = now()
        where id = (
          select id
          from public.jobs
          where status = 'queued'
          order by created_at
          limit 1
        )
        returning id, job_type, source_id
        """
      )
      row = await cur.fetchone()
      await conn.commit()
      return dict(row) if row else None


async def _complete_job(job_id: str, success: bool) -> None:
  status = "completed" if success else "failed"
  await execute(
    "update public.jobs set status = %s, completed_at = now() where id = %s",
    (status, job_id),
  )


async def worker_loop(poll_interval_seconds: float = 2.0) -> None:
  logger.info("Indexing worker loop started.")
  while True:
    job = await _claim_next_job()
    if not job:
      await asyncio.sleep(poll_interval_seconds)
      continue

    job_id = str(job["id"])
    job_type = JobType(job["job_type"])
    logger.info("Processing job %s of type %s", job_id, job_type.value)

    try:
      if job_type is JobType.PARSE:
        await run_parse_job(job_id)
        # Fan-out: enqueue chunk and embed jobs for same source
        await execute(
          """
          insert into public.jobs (workspace_id, source_id, job_type, status)
          select workspace_id, source_id, 'chunk', 'queued'
          from public.jobs
          where id = %s
          """,
          (job_id,),
        )
      elif job_type is JobType.CHUNK:
        await run_chunk_job(job_id)
        await execute(
          """
          insert into public.jobs (workspace_id, source_id, job_type, status)
          select workspace_id, source_id, 'embed', 'queued'
          from public.jobs
          where id = %s
          """,
          (job_id,),
        )
      elif job_type is JobType.EMBED:
        await run_embed_job(job_id)
        # When embeddings are done we can mark the source as fully indexed.
        await execute(
          """
          update public.sources
          set status = 'indexed'
          where id = (
            select source_id from public.jobs where id = %s
          )
          """,
          (job_id,),
        )
      else:
        logger.info("Job type %s is not handled yet", job_type.value)

      await _complete_job(job_id, success=True)
    except Exception:
      logger.exception("Job %s failed", job_id)
      await _complete_job(job_id, success=False)


def main() -> None:
  load_dotenv()
  configure_event_loop()
  configure_logging()
  logger.info("Indexing worker starting up.")
  try:
    asyncio.run(worker_loop())
  except KeyboardInterrupt:
    logger.info("Indexing worker stopped via KeyboardInterrupt.")


if __name__ == "__main__":
  main()

