"""FastAPI backend: public feed + swipe deck + profiles + leaderboard."""
from io import BytesIO
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from sqlmodel import Session, select

try:
    from pillow_heif import register_heif_opener
except ImportError:  # wheel needs patched rpath on NixOS; HEIC unsupported then
    register_heif_opener = None


from models import (
    UPLOADS_DIR,
    Comment,
    CommentCreate,
    CommentOut,
    LeaderboardEntry,
    Match,
    Photo,
    Post,
    PostCreate,
    PostLike,
    PostOut,
    ProfileOut,
    Prompt,
    PromptIn,
    Swipe,
    SwipeIn,
    User,
    UserCreate,
    UserUpdate,
    create_db_and_tables,
    engine,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

if register_heif_opener:
    register_heif_opener()

# Formats browsers render natively; anything else Pillow can decode is
# transcoded to JPEG (HEIC/HEIF from iPhones, TIFF, BMP, ...).
_PASSTHROUGH_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp", "GIF": ".gif"}


def save_image(data: bytes) -> str:
    """Validate + normalize an uploaded image; return the stored filename."""
    try:
        img = Image.open(BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=415, detail="unsupported image file")
    ext = _PASSTHROUGH_FORMATS.get(img.format or "")
    filename = f"{uuid4().hex}{ext or '.jpg'}"
    dest = UPLOADS_DIR / filename
    if ext:
        dest.write_bytes(data)
    else:
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img.save(dest, "JPEG", quality=90)
    return filename


@app.on_event("startup")
def on_startup() -> None:
    create_db_and_tables()


# ---------- helpers ----------

def get_user_or_404(session: Session, user_id: int) -> User:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def photo_urls(session: Session, user_id: int) -> list[str]:
    photos = session.exec(
        select(Photo).where(Photo.user_id == user_id).order_by(Photo.sort_order)
    ).all()
    return [f"/uploads/{p.path}" for p in photos]


def recompute_profile_complete(session: Session, user: User) -> None:
    photo_count = len(session.exec(select(Photo).where(Photo.user_id == user.id)).all())
    prompt_count = len(session.exec(select(Prompt).where(Prompt.user_id == user.id)).all())
    user.profile_complete = photo_count >= 1 and prompt_count >= 2


def profile_out(session: Session, user: User) -> ProfileOut:
    prompts = session.exec(
        select(Prompt).where(Prompt.user_id == user.id).order_by(Prompt.created_at)
    ).all()
    return ProfileOut(
        id=user.id,
        name=user.name,
        age=user.age,
        bio=user.bio,
        gender=user.gender,
        interested_in=user.interested_in,
        profile_complete=user.profile_complete,
        photos=photo_urls(session, user.id),
        prompts=[PromptIn(prompt_key=p.prompt_key, answer=p.answer) for p in prompts],
    )


def post_out(session: Session, post: Post, viewer_id: int | None) -> PostOut:
    author = session.get(User, post.user_id)
    likes = session.exec(select(PostLike).where(PostLike.post_id == post.id)).all()
    comment_count = len(
        session.exec(select(Comment).where(Comment.post_id == post.id)).all()
    )
    photos = photo_urls(session, post.user_id)
    return PostOut(
        id=post.id,
        text=post.text,
        image=f"/uploads/{post.image_path}" if post.image_path else None,
        like_count=len(likes),
        liked_by_me=viewer_id is not None and any(l.user_id == viewer_id for l in likes),
        comment_count=comment_count,
        author_id=author.id,
        author_name=author.name,
        author_age=author.age,
        author_photo=photos[0] if photos else None,
        created_at=post.created_at,
    )


def comment_out(session: Session, comment: Comment) -> CommentOut:
    author = session.get(User, comment.user_id)
    photos = photo_urls(session, comment.user_id)
    return CommentOut(
        id=comment.id,
        post_id=comment.post_id,
        parent_id=comment.parent_id,
        text=comment.text,
        author_id=author.id,
        author_name=author.name,
        author_photo=photos[0] if photos else None,
        created_at=comment.created_at,
    )


# ---------- users ----------

@app.post("/users")
def create_user(body: UserCreate) -> dict:
    with Session(engine) as session:
        user = User(
            name=body.name,
            age=body.age,
            bio=body.bio,
            gender=body.gender,
            interested_in=body.interested_in,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return {"id": user.id, "token": user.token}


@app.get("/users")
def list_users() -> list[dict]:
    with Session(engine) as session:
        users = session.exec(select(User).order_by(User.id)).all()
        return [
            {
                "id": u.id,
                "name": u.name,
                "age": u.age,
                "photo": (photo_urls(session, u.id) or [None])[0],
            }
            for u in users
        ]


@app.patch("/users/{user_id}", response_model=ProfileOut)
def update_user(user_id: int, body: UserUpdate) -> ProfileOut:
    with Session(engine) as session:
        user = get_user_or_404(session, user_id)
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(user, field, value)
        recompute_profile_complete(session, user)
        session.add(user)
        session.commit()
        session.refresh(user)
        return profile_out(session, user)


@app.post("/users/{user_id}/photos")
def upload_photo(user_id: int, file: UploadFile = File(...)) -> dict:
    with Session(engine) as session:
        user = get_user_or_404(session, user_id)
        filename = save_image(file.file.read())
        existing = session.exec(select(Photo).where(Photo.user_id == user_id)).all()
        session.add(Photo(user_id=user_id, path=filename, sort_order=len(existing)))
        recompute_profile_complete(session, user)
        session.add(user)
        session.commit()
        return {"url": f"/uploads/{filename}"}


@app.put("/users/{user_id}/prompts", response_model=ProfileOut)
def set_prompts(user_id: int, body: list[PromptIn]) -> ProfileOut:
    with Session(engine) as session:
        user = get_user_or_404(session, user_id)
        for p in session.exec(select(Prompt).where(Prompt.user_id == user_id)).all():
            session.delete(p)
        for item in body:
            session.add(Prompt(user_id=user_id, prompt_key=item.prompt_key, answer=item.answer))
        recompute_profile_complete(session, user)
        session.add(user)
        session.commit()
        session.refresh(user)
        return profile_out(session, user)


@app.get("/profiles/{user_id}", response_model=ProfileOut)
def get_profile(user_id: int) -> ProfileOut:
    with Session(engine) as session:
        user = get_user_or_404(session, user_id)
        return profile_out(session, user)


# ---------- posts & feed ----------

@app.post("/uploads")
def upload_image(file: UploadFile = File(...)) -> dict:
    """Store an image and return its filename for use in a post."""
    return {"path": save_image(file.file.read())}


@app.post("/posts", response_model=PostOut)
def create_post(user_id: int, body: PostCreate) -> PostOut:
    text = body.text.strip()
    if body.image and ("/" in body.image or "\\" in body.image):
        raise HTTPException(status_code=422, detail="invalid image path")
    if not text and not body.image:
        raise HTTPException(status_code=422, detail="post needs text or an image")
    with Session(engine) as session:
        get_user_or_404(session, user_id)
        post = Post(user_id=user_id, text=text, image_path=body.image)
        session.add(post)
        session.commit()
        session.refresh(post)
        return post_out(session, post, user_id)


@app.get("/feed", response_model=list[PostOut])
def get_feed(user_id: int | None = None) -> list[PostOut]:
    with Session(engine) as session:
        posts = session.exec(select(Post).order_by(Post.created_at.desc())).all()
        return [post_out(session, p, user_id) for p in posts]


@app.post("/posts/{post_id}/like")
def toggle_like(post_id: int, user_id: int) -> dict:
    with Session(engine) as session:
        if session.get(Post, post_id) is None:
            raise HTTPException(status_code=404, detail="Post not found")
        get_user_or_404(session, user_id)
        existing = session.exec(
            select(PostLike).where(
                PostLike.post_id == post_id, PostLike.user_id == user_id
            )
        ).first()
        if existing is not None:
            session.delete(existing)
            liked = False
        else:
            session.add(PostLike(user_id=user_id, post_id=post_id))
            liked = True
        session.commit()
        like_count = len(
            session.exec(select(PostLike).where(PostLike.post_id == post_id)).all()
        )
        return {"liked": liked, "like_count": like_count}


@app.get("/posts/{post_id}/comments", response_model=list[CommentOut])
def get_comments(post_id: int) -> list[CommentOut]:
    with Session(engine) as session:
        if session.get(Post, post_id) is None:
            raise HTTPException(status_code=404, detail="Post not found")
        comments = session.exec(
            select(Comment).where(Comment.post_id == post_id).order_by(Comment.created_at)
        ).all()
        return [comment_out(session, c) for c in comments]


@app.post("/posts/{post_id}/comments", response_model=CommentOut)
def add_comment(post_id: int, user_id: int, body: CommentCreate) -> CommentOut:
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="comment text required")
    with Session(engine) as session:
        if session.get(Post, post_id) is None:
            raise HTTPException(status_code=404, detail="Post not found")
        get_user_or_404(session, user_id)
        parent_id = body.parent_id
        if parent_id is not None:
            parent = session.get(Comment, parent_id)
            if parent is None or parent.post_id != post_id:
                raise HTTPException(status_code=404, detail="Parent comment not found")
            # Threading stays one level deep: a reply to a reply joins the root.
            if parent.parent_id is not None:
                parent_id = parent.parent_id
        comment = Comment(
            post_id=post_id, user_id=user_id, parent_id=parent_id, text=text
        )
        session.add(comment)
        session.commit()
        session.refresh(comment)
        return comment_out(session, comment)


# ---------- swipes & matches ----------

@app.get("/deck", response_model=list[ProfileOut])
def get_deck(user_id: int) -> list[ProfileOut]:
    with Session(engine) as session:
        get_user_or_404(session, user_id)
        swiped_ids = {
            s.swiped_id
            for s in session.exec(select(Swipe).where(Swipe.swiper_id == user_id)).all()
        }
        users = session.exec(select(User).order_by(User.created_at.desc())).all()
        return [
            profile_out(session, u)
            for u in users
            if u.id != user_id and u.id not in swiped_ids
        ]


@app.post("/swipes")
def record_swipe(swiper_id: int, body: SwipeIn) -> dict:
    with Session(engine) as session:
        get_user_or_404(session, swiper_id)
        get_user_or_404(session, body.swiped_id)
        existing = session.exec(
            select(Swipe).where(
                Swipe.swiper_id == swiper_id, Swipe.swiped_id == body.swiped_id
            )
        ).first()
        if existing is not None:
            existing.direction = body.direction
            session.add(existing)
        else:
            session.add(
                Swipe(swiper_id=swiper_id, swiped_id=body.swiped_id, direction=body.direction)
            )
        matched = False
        match_id = None
        if body.direction == "right":
            reciprocal = session.exec(
                select(Swipe).where(
                    Swipe.swiper_id == body.swiped_id,
                    Swipe.swiped_id == swiper_id,
                    Swipe.direction == "right",
                )
            ).first()
            if reciprocal is not None:
                a, b = min(swiper_id, body.swiped_id), max(swiper_id, body.swiped_id)
                match = session.exec(
                    select(Match).where(Match.user_a == a, Match.user_b == b)
                ).first()
                if match is None:
                    match = Match(user_a=a, user_b=b)
                    session.add(match)
                    session.commit()
                    session.refresh(match)
                matched = True
                match_id = match.id
        session.commit()
        return {"matched": matched, "match_id": match_id}


@app.get("/users/{user_id}/matches")
def get_matches(user_id: int) -> list[dict]:
    with Session(engine) as session:
        get_user_or_404(session, user_id)
        matches = session.exec(
            select(Match).where((Match.user_a == user_id) | (Match.user_b == user_id))
        ).all()
        out = []
        for m in matches:
            other_id = m.user_b if m.user_a == user_id else m.user_a
            other = session.get(User, other_id)
            if other is None:
                continue
            out.append(
                {
                    "match_id": m.id,
                    "matched_at": m.created_at,
                    "profile": profile_out(session, other),
                }
            )
        return out


# ---------- leaderboard ----------

@app.get("/leaderboard", response_model=list[LeaderboardEntry])
def get_leaderboard() -> list[LeaderboardEntry]:
    with Session(engine) as session:
        users = session.exec(select(User)).all()
        entries = []
        for u in users:
            matches = len(
                session.exec(
                    select(Match).where((Match.user_a == u.id) | (Match.user_b == u.id))
                ).all()
            )
            post_ids = [
                p.id for p in session.exec(select(Post).where(Post.user_id == u.id)).all()
            ]
            post_likes = (
                len(
                    session.exec(
                        select(PostLike).where(PostLike.post_id.in_(post_ids))
                    ).all()
                )
                if post_ids
                else 0
            )
            right_swipes = len(
                session.exec(
                    select(Swipe).where(
                        Swipe.swiped_id == u.id, Swipe.direction == "right"
                    )
                ).all()
            )
            photos = photo_urls(session, u.id)
            entries.append(
                LeaderboardEntry(
                    user_id=u.id,
                    name=u.name,
                    photo=photos[0] if photos else None,
                    matches=matches,
                    post_likes=post_likes,
                    right_swipes_received=right_swipes,
                    score=matches * 10 + post_likes * 3 + right_swipes,
                )
            )
        entries.sort(key=lambda e: e.score, reverse=True)
        return entries
