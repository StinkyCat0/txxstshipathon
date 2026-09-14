"""Database schema + engine. Single source of truth for the backend.

SQLite file lives next to this module. `create_db_and_tables()` is called
on app startup; `seed.py` populates demo data.
"""
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from sqlmodel import Field, SQLModel, create_engine

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "app.db"
UPLOADS_DIR = BASE_DIR / "uploads"

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------- tables ----------

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    token: str = Field(default_factory=lambda: uuid4().hex, index=True)
    name: str
    age: int
    bio: str = ""
    gender: str = ""            # free-form for MVP
    interested_in: str = ""     # free-form for MVP
    profile_complete: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class Photo(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    path: str                   # served at /uploads/<path>
    sort_order: int = 0


class Prompt(SQLModel, table=True):
    """A Hinge-style profile section: prompt question + text answer."""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    prompt_key: str             # e.g. "green_flag", "shower_thought"
    answer: str
    created_at: datetime = Field(default_factory=utcnow)


class Post(SQLModel, table=True):
    """A feed post: free-form text with an optional image."""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    text: str = ""
    image_path: Optional[str] = None    # served at /uploads/<path>
    created_at: datetime = Field(default_factory=utcnow)


class Comment(SQLModel, table=True):
    """A comment on a post. `parent_id` is set for replies (one level deep)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    post_id: int = Field(foreign_key="post.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    parent_id: Optional[int] = Field(default=None, foreign_key="comment.id", index=True)
    text: str
    created_at: datetime = Field(default_factory=utcnow)


class Swipe(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    swiper_id: int = Field(foreign_key="user.id", index=True)
    swiped_id: int = Field(foreign_key="user.id", index=True)
    direction: str              # "left" | "right"
    created_at: datetime = Field(default_factory=utcnow)


class Match(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_a: int = Field(foreign_key="user.id", index=True)
    user_b: int = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=utcnow)


class PostLike(SQLModel, table=True):
    """A like on a feed post."""
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    post_id: int = Field(foreign_key="post.id", index=True)
    created_at: datetime = Field(default_factory=utcnow)


# ---------- response schemas (not tables) ----------

class UserCreate(SQLModel):
    name: str
    age: int
    bio: str = ""
    gender: str = ""
    interested_in: str = ""


class UserUpdate(SQLModel):
    name: Optional[str] = None
    age: Optional[int] = None
    bio: Optional[str] = None
    gender: Optional[str] = None
    interested_in: Optional[str] = None


class PromptIn(SQLModel):
    prompt_key: str
    answer: str


class SwipeIn(SQLModel):
    swiped_id: int
    direction: str              # "left" | "right"


class ProfileOut(SQLModel):
    """Full profile: user + photos + prompt answers."""
    id: int
    name: str
    age: int
    bio: str
    gender: str
    interested_in: str
    profile_complete: bool
    photos: list[str]           # urls
    prompts: list[PromptIn]


class PostCreate(SQLModel):
    text: str = ""
    image: Optional[str] = None     # filename returned by POST /uploads


class CommentCreate(SQLModel):
    text: str
    parent_id: Optional[int] = None


class PostOut(SQLModel):
    """One feed card: a post (+ author + first photo + engagement counts)."""
    id: int
    text: str
    image: Optional[str]
    like_count: int
    liked_by_me: bool
    comment_count: int
    author_id: int
    author_name: str
    author_age: int
    author_photo: Optional[str]
    created_at: datetime


class CommentOut(SQLModel):
    id: int
    post_id: int
    parent_id: Optional[int]
    text: str
    author_id: int
    author_name: str
    author_photo: Optional[str]
    created_at: datetime


class LeaderboardEntry(SQLModel):
    user_id: int
    name: str
    photo: Optional[str]
    matches: int
    post_likes: int
    right_swipes_received: int
    score: int


def create_db_and_tables() -> None:
    UPLOADS_DIR.mkdir(exist_ok=True)
    SQLModel.metadata.create_all(engine)
