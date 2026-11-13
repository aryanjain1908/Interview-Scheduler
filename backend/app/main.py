from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

from app import scheduler
from app.core.config import settings
from app.core.errors import DomainError
from app.core.logging import RequestLoggingMiddleware, setup_logging
from app.routers import admin, auth, catalog, interviewer, notifications, student, team

setup_logging()


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("API starting (scheduler {})", "on" if settings.scheduler_enabled else "off")
    scheduler.start()
    yield
    scheduler.stop()
    logger.info("API stopped")


app = FastAPI(
    lifespan=lifespan,
    title="GRIT Interview Scheduling API",
    description="Booking, availability and outcomes for GRIT Track Badge interviews.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)
app.add_middleware(RequestLoggingMiddleware)


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    logger.warning("Refused {} {}: {} ({})", request.method, request.url.path, exc.code, exc.message)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message, "code": exc.code})


@app.exception_handler(Exception)
async def unhandled_error_handler(_: Request, __: Exception) -> JSONResponse:
    # Already logged, with its request id and traceback, by RequestLoggingMiddleware.
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on our side. Please try again.", "code": "server_error"})


for router in (
    catalog.router,
    auth.router,
    notifications.router,
    student.router,
    interviewer.router,
    team.router,
    admin.router,
):
    app.include_router(router, prefix="/api")


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}
