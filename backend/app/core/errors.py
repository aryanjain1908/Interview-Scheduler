"""Domain errors raised by services and mapped to HTTP responses in main.py."""


class DomainError(Exception):
    status_code = 400

    def __init__(self, message: str, code: str = "bad_request"):
        super().__init__(message)
        self.message = message
        self.code = code


class NotFound(DomainError):
    status_code = 404


class Forbidden(DomainError):
    status_code = 403


class Conflict(DomainError):
    status_code = 409


class RuleViolation(DomainError):
    """A request that is well-formed but breaks a product rule."""

    status_code = 422
