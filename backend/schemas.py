from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    username: str


class EnvVarCreate(BaseModel):
    key: str = Field(min_length=1, max_length=120)
    value: str = Field(default="")


class EnvVarResponse(EnvVarCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


class BuildLogResponse(BaseModel):
    id: int
    deployment_id: int
    log_line: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class DeploymentCreate(BaseModel):
    project_name: str = Field(min_length=2, max_length=120)
    project_type: str = Field(default="unknown", max_length=60)
    build_command: str = Field(default="npm run build", max_length=255)
    run_command: str = Field(default="npm run start", max_length=255)
    env_vars: list[EnvVarCreate] = Field(default_factory=list)


class DeploymentSummaryResponse(BaseModel):
    id: int
    project_name: str
    project_type: str
    status: str
    public_url: str | None = None
    runtime_url: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DeploymentDetailResponse(DeploymentSummaryResponse):
    build_command: str | None = None
    run_command: str | None = None
    env_vars: list[EnvVarResponse] = Field(default_factory=list)
    logs: list[BuildLogResponse] = Field(default_factory=list)
