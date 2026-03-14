import os
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

import psycopg
from psycopg.rows import dict_row


def _get_database_url() -> str:
  database_url = os.getenv("DATABASE_URL")
  if not database_url:
    raise RuntimeError("DATABASE_URL is not set for indexing worker")
  return database_url


@asynccontextmanager
async def get_connection() -> AsyncIterator[psycopg.AsyncConnection[Any]]:
  conn = await psycopg.AsyncConnection.connect(_get_database_url(), row_factory=dict_row)
  try:
    yield conn
  finally:
    await conn.close()


async def fetch_one(query: str, params: tuple[Any, ...]) -> dict[str, Any] | None:
  async with get_connection() as conn:
    async with conn.cursor() as cur:
      await cur.execute(query, params)
      row = await cur.fetchone()
      return dict(row) if row is not None else None


async def fetch_all(query: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
  async with get_connection() as conn:
    async with conn.cursor() as cur:
      await cur.execute(query, params)
      rows = await cur.fetchall()
      return [dict(r) for r in rows]


async def execute(query: str, params: tuple[Any, ...]) -> None:
  async with get_connection() as conn:
    async with conn.cursor() as cur:
      await cur.execute(query, params)
      await conn.commit()

