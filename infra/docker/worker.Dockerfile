FROM python:3.11-slim AS base

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY services/indexing-worker/pyproject.toml services/indexing-worker/pyproject.toml
COPY services/indexing-worker/requirements.txt services/indexing-worker/requirements.txt

RUN pip install --no-cache-dir -r services/indexing-worker/requirements.txt

COPY services/indexing-worker/src services/indexing-worker/src

CMD ["python", "-m", "services.indexing-worker.src.main"]

