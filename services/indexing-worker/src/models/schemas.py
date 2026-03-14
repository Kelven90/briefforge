from __future__ import annotations

from enum import Enum
from pydantic import BaseModel, UUID4


class JobType(str, Enum):
  PARSE = "parse"
  CHUNK = "chunk"
  EMBED = "embed"
  REINDEX = "reindex"
  EVAL = "eval"


class IndexingJobPayload(BaseModel):
  jobId: UUID4
  workspaceId: UUID4
  sourceId: UUID4
  jobType: JobType

