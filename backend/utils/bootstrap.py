from sqlalchemy.orm import Session

from models import User
from utils.security import hash_password


DEFAULT_USERNAME = "testing"
DEFAULT_PASSWORD = "123"


def seed_default_user(db: Session) -> None:
    existing_user = db.query(User).filter(User.username == DEFAULT_USERNAME).first()
    if existing_user:
        return

    user = User(
        username=DEFAULT_USERNAME,
        password_hash=hash_password(DEFAULT_PASSWORD),
    )
    db.add(user)
    db.commit()
