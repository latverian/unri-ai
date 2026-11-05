FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 DATA_DIR=/data
COPY requirements.txt requirements-local-embed.txt ./
# Default memakai embedding Gemini supaya image kecil. Untuk embedding lokal:
#   docker build --build-arg LOCAL_EMBED=1 .
ARG LOCAL_EMBED=0
RUN pip install --no-cache-dir -r requirements.txt && \
    if [ "$LOCAL_EMBED" = "1" ]; then pip install --no-cache-dir -r requirements-local-embed.txt; fi
COPY app ./app
VOLUME /data
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
