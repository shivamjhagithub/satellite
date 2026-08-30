# syntax=docker/dockerfile:1
FROM python:3.12-slim-bookworm

ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends gdal-bin libgdal-dev gcc g++ python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip \
    && pip install torch==2.8.0 torchvision==0.23.0 --index-url ${TORCH_INDEX_URL} \
    && pip install -r requirements.txt
COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
