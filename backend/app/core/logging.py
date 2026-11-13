import inspect
import logging
import sys
import time
import uuid

from fastapi import Request
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

TEXT_FORMAT = (
    "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | "
    "<cyan>{extra[request_id]}</cyan> | <cyan>{name}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
)


class InterceptHandler(logging.Handler):
    """Sends records from libraries that use the standard `logging` module through loguru."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno
        frame, depth = inspect.currentframe(), 0
        while frame and (depth == 0 or frame.f_code.co_filename == logging.__file__):
            frame = frame.f_back
            depth += 1
        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def setup_logging() -> None:
    logger.remove()
    logger.configure(extra={"request_id": "-"})
    logger.add(
        sys.stderr,
        level=settings.log_level.upper(),
        format=TEXT_FORMAT,
        serialize=settings.log_json,
        backtrace=False,
        diagnose=False,
        enqueue=True,
    )
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    for name in ("uvicorn", "uvicorn.error", "fastapi"):
        lib = logging.getLogger(name)
        lib.handlers = [InterceptHandler()]
        lib.propagate = False
    # Requests are logged by RequestLoggingMiddleware, with timing and a request id.
    logging.getLogger("uvicorn.access").disabled = True
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        started = time.perf_counter()
        with logger.contextualize(request_id=request_id):
            try:
                response = await call_next(request)
            except Exception:
                logger.exception("{} {} failed", request.method, request.url.path)
                raise
            ms = (time.perf_counter() - started) * 1000
            if request.url.path != "/api/health":
                level = "ERROR" if response.status_code >= 500 else "WARNING" if response.status_code >= 400 else "INFO"
                logger.log(level, "{} {} -> {} in {:.0f} ms", request.method, request.url.path, response.status_code, ms)
        response.headers["X-Request-ID"] = request_id
        return response
