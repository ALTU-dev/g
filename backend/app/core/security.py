from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from app.core.config import settings
from fastapi import Depends, HTTPException, status, Security
from fastapi.security import OAuth2PasswordBearer, APIKeyHeader
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.services.api_key import APIKeyService

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login/access-token",
    auto_error=False,
)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

DEFAULT_WORKSPACE_USERNAME = "local_workspace"
DEFAULT_WORKSPACE_EMAIL = "local-workspace@altbot.local"


def get_or_create_default_user(db: Session) -> User:
    """Return the built-in local workspace user used when auth is disabled."""
    user = (
        db.query(User)
        .filter(
            (User.username == DEFAULT_WORKSPACE_USERNAME)
            | (User.email == DEFAULT_WORKSPACE_EMAIL)
        )
        .first()
    )
    if user:
        return user

    existing_user = db.query(User).order_by(User.id.asc()).first()
    if existing_user:
        return existing_user

    user = User(
        email=DEFAULT_WORKSPACE_EMAIL,
        username=DEFAULT_WORKSPACE_USERNAME,
        hashed_password=get_password_hash("local-workspace"),
        is_active=True,
        is_superuser=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return (
            db.query(User)
            .filter(
                (User.username == DEFAULT_WORKSPACE_USERNAME)
                | (User.email == DEFAULT_WORKSPACE_EMAIL)
            )
            .first()
        )

    db.refresh(user)
    return user

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt 

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    if not token:
        return get_or_create_default_user(db)

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        return get_or_create_default_user(db)
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        return get_or_create_default_user(db)
    if not user.is_active:
        return get_or_create_default_user(db)
    return user 

def get_api_key_user(
    db: Session = Depends(get_db),
    api_key: str = Security(api_key_header),
) -> User:
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key header missing",
        )
    
    api_key_obj = APIKeyService.get_api_key_by_key(db=db, key=api_key)
    if not api_key_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    
    if not api_key_obj.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive API key",
        )
    
    APIKeyService.update_last_used(db=db, api_key=api_key_obj)
    return api_key_obj.user 
