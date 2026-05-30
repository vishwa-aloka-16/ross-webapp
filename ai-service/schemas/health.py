from pydantic import BaseModel


class HealthCheck(BaseModel):
    status: str
    detail: str


class HealthResponse(BaseModel):
    status: str
    checks: dict[str, HealthCheck]
