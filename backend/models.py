from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    deployments = relationship(
        "Deployment", back_populates="user", cascade="all, delete-orphan"
    )


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_name = Column(String(120), nullable=False)
    project_type = Column(String(60), nullable=False)
    status = Column(String(30), nullable=False, default="Building")
    public_url = Column(String(255), nullable=True)
    build_command = Column(String(255), nullable=True)
    run_command = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="deployments")
    env_vars = relationship(
        "EnvironmentVariable", back_populates="deployment", cascade="all, delete-orphan"
    )
    logs = relationship("BuildLog", back_populates="deployment", cascade="all, delete-orphan")


class EnvironmentVariable(Base):
    __tablename__ = "environment_variables"

    id = Column(Integer, primary_key=True, index=True)
    deployment_id = Column(Integer, ForeignKey("deployments.id"), nullable=False)
    key = Column(String(120), nullable=False)
    value = Column(Text, nullable=False)

    deployment = relationship("Deployment", back_populates="env_vars")


class BuildLog(Base):
    __tablename__ = "build_logs"

    id = Column(Integer, primary_key=True, index=True)
    deployment_id = Column(Integer, ForeignKey("deployments.id"), nullable=False)
    log_line = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    deployment = relationship("Deployment", back_populates="logs")
