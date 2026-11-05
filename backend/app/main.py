"""Aplikasi FastAPI UNRI GPT. Jalankan: uvicorn app.main:app --reload"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import db
from app.api import admin, chat, public
from app.core import config

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init()
    yield


app = FastAPI(title="UNRI GPT API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"],
                   allow_headers=["*"])


# Semua error JSON memakai format {"error": {"code", "message"}} (lihat spec/requirements.md §5).
@app.exception_handler(HTTPException)
async def http_error(_req: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "HTTP_ERROR", "message": str(exc.detail)}
    return JSONResponse({"error": detail}, status_code=exc.status_code, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_error(_req: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    msg = str(first.get("msg", "Data tidak valid.")).removeprefix("Value error, ")
    return JSONResponse({"error": {"code": "VALIDATION_ERROR", "message": msg}}, status_code=422)


for r in (public.router, chat.router, admin.router):
    app.include_router(r, prefix="/api")
