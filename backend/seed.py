"""Seed the database with demo data. Run: python3 seed.py (from backend/).

Profile photos: drop real images in seed-photos/ named by user index
(1.jpg, 2.png, ...; add -1, -2 suffixes for extra photos per user).
Falls back to generated initial avatars when no file matches.
"""
import hashlib
import random
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from sqlmodel import Session, delete

from models import (
    UPLOADS_DIR,
    Comment,
    Match,
    Photo,
    Post,
    PostLike,
    Prompt,
    Swipe,
    User,
    create_db_and_tables,
    engine,
)

SEED_PHOTOS_DIR = Path(__file__).parent / "seed-photos"

random.seed(42)

USERS = [
    ("Maya", 24, "F", "M", "Professional overthinker, amateur chef.", "Brooklyn, NY"),
    ("Jordan", 27, "M", "F", "Will beat you at Mario Kart and deny it.", "Austin, TX"),
    ("Priya", 26, "F", "M", "Bookstore browser, chai enthusiast.", "London, UK"),
    ("Alex", 23, "NB", "everyone", "Here for the playlists and the chaos.", "Berlin, DE"),
    ("Sam", 29, "M", "F", "Climbing walls and corporate ladders.", "Denver, CO"),
    ("Riley", 22, "F", "everyone", "Dog mom. The dog is a cat.", "Portland, OR"),
    ("Devon", 31, "M", "M", "Grill master seeking sous chef.", "Nashville, TN"),
    ("Nina", 25, "F", "M", "Fluent in sarcasm and movie quotes.", "Chicago, IL"),
    ("Kai", 28, "M", "F", "Surfer on weekends, spreadsheet goblin on weekdays.", "San Diego, CA"),
    ("Zoe", 21, "F", "F", "Art kid. Will sketch you on the first date.", "Providence, RI"),
    ("Marcus", 34, "M", "F", "Old soul, young knees (barely).", "Atlanta, GA"),
    ("Lena", 30, "F", "M", "Plant hoarder. 47 plants and counting.", "Seattle, WA"),
    ("Omar", 26, "M", "everyone", "Foodie. I will judge your pizza order.", "Toronto, CA"),
    ("Tara", 19, "F", "M", "Freshman energy, senior-year nap schedule.", "Boulder, CO"),
    ("Ben", 33, "M", "F", "Dad jokes without the dad part.", "Boston, MA"),
    ("Ivy", 27, "F", "F", "Runner. Emotionally and literally.", "Minneapolis, MN"),
    ("Chris", 25, "M", "F", "Gym rat with a soft spot for rom-coms.", "Phoenix, AZ"),
    ("Aisha", 29, "F", "M", "Lawyer by day, karaoke menace by night.", "Washington, DC"),
    ("Leo", 24, "M", "everyone", "Astrophysics nerd. Ask me about black holes.", "Palo Alto, CA"),
    ("Grace", 35, "F", "M", "Wine aunt energy, single by choice-ish.", "New Orleans, LA"),
]

PROMPT_ANSWERS = {
    "green_flag": [
        "You text back in complete sentences.",
        "You have a library card and actually use it.",
        "You wave at dogs before their owners.",
        "You remember the little things I mention once.",
        "You can assemble IKEA furniture without a fight.",
        "You hype up your friends' bad ideas anyway.",
    ],
    "shower_thought": [
        "Every mirror you buy is used.",
        "My dog thinks I have a job where I hunt for food all day.",
        "Aliens probably skip Earth because we put pineapple on pizza.",
        "Somewhere out there is the last photo I'll ever be in.",
        "Coffee is just bean soup and we all agreed to pretend otherwise.",
        "The word 'queue' is just Q followed by four silent letters.",
    ],
    "two_truths": [
        "I've met a celebrity in an airport bathroom; I can juggle; I've never broken a bone.",
        "I speak three languages; I once ate 40 nuggets; I hate cilantro.",
        "I was on a game show; I can't whistle; I own 12 houseplants named after exes.",
        "I've run a marathon; I sleep with socks on; I've never seen Star Wars.",
        "I have a twin; I'm allergic to cats but own two; I can solve a Rubik's cube.",
    ],
    "unpopular_opinion": [
        "Cereal is better dry.",
        "Airport food is genuinely good and I'm tired of pretending it's not.",
        "Reply-all emails should be a fireable offense.",
        "Winter is the best season and summer people are lying.",
        "Brunch is just expensive breakfast with a dress code.",
        "Group chats should have a word limit.",
    ],
    "sunday_plans": [
        "Farmers market, then aggressively doing nothing.",
        "Meal prep I won't follow, laundry I'll rewash.",
        "Brunch, nap, existential dread, repeat.",
        "Long walk with a podcast about murders.",
        "Pretending to clean while watching cooking shows.",
    ],
    "red_flag_i_ignore": [
        "Saying 'I'm five minutes away' from the shower.",
        "Having 47 unread texts and calling it 'boundaries'.",
        "Owning a sword 'ironically'.",
        "Describing yourself as an 'entrepreneur' with no further detail.",
        "Being rude to waiters but tipping well to compensate.",
    ],
    "most_spontaneous": [
        "Booked a flight to Lisbon during a work meeting.",
        "Got a tattoo of a potato at 2am. No regrets.",
        "Adopted a cat I met once in a parking lot.",
        "Quit a job and drove to the coast the same day.",
        "Entered a hot dog eating contest on a dare. Lost badly.",
    ],
    "dating_me_is": [
        "Like a golden retriever: loyal, excitable, easily distracted by food.",
        "A group project where I actually do my part.",
        "Free therapy, except I'm the one who needs it.",
        "An open bar with a two-drink minimum of emotional availability.",
        "Netflix asking 'are you still watching?' — the answer is always yes.",
    ],
}

POST_TEXTS = [
    "Three hours into a bread recipe and I've produced a brick. Sending it to the group chat.",
    "Found a coffee shop with no wifi and it's the most productive I've been all month.",
    "Someone left a piano on my street. I don't play. I'm learning.",
    "The sunset tonight was doing the absolute most. No filter needed.",
    "Day 6 of the plant rescue. New leaf. I'm emotional.",
    "Ran 5k without stopping and immediately told everyone I know.",
    "Made dumplings from scratch. Kitchen looks like a crime scene. Worth it.",
    "My dog has decided the laundry basket is his. I've lost.",
    "Bookstore haul: four books I will absolutely read. Probably.",
    "Tried to be spontaneous and booked a pottery class. Made a bowl. It's a bowl.",
    "New playlist is 40% songs I've never heard and 60% songs from 2011.",
    "Went to the beach in the rain. Would recommend.",
    "Cooked for eight people and only set off the smoke alarm twice.",
    "Found my old sketchbook from high school. Past me had opinions.",
    "The farmers market had peaches the size of my head. Bought six.",
]

POST_COMMENTS = [
    "This is incredible.",
    "Okay but where is this?",
    "I need the recipe immediately.",
    "Sending this to my group chat right now.",
    "You're living the dream.",
    "This is the content I'm here for.",
    "Absolutely unhinged. Love it.",
    "Wait, tell me more.",
    "I felt this in my soul.",
    "Next time invite me.",
]

POST_REPLIES = [
    "Right?? I couldn't believe it either.",
    "Come over, I'll make extra.",
    "Honestly same.",
    "You're on. Saturday?",
    "It's at the corner of 4th and Main.",
    "Ha! I'll take that as a compliment.",
]

COLORS = [
    (239, 154, 154), (244, 143, 177), (206, 147, 216), (179, 157, 219),
    (159, 168, 218), (144, 202, 249), (129, 212, 250), (128, 222, 234),
    (128, 203, 196), (165, 214, 167), (197, 225, 165), (230, 238, 156),
    (255, 245, 157), (255, 224, 130), (255, 204, 128), (255, 171, 145),
    (188, 170, 164), (176, 190, 197), (240, 128, 128), (135, 206, 235),
]


def make_avatar(path, initials, color):
    img = Image.new("RGB", (600, 800), color)
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=200)
    bbox = draw.textbbox((0, 0), initials, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((600 - w) / 2 - bbox[0], (800 - h) / 2 - bbox[1]), initials,
              fill="white", font=font)
    img.save(path)


def shade(color, factor):
    return tuple(min(255, max(0, int(c * factor))) for c in color)


def make_post_image(path, color, label):
    """A stand-in 'photo' for seeded posts: colored card with a caption."""
    img = Image.new("RGB", (900, 900), color)
    draw = ImageDraw.Draw(img)
    draw.rectangle([40, 40, 860, 860], outline=shade(color, 0.6), width=8)
    font = ImageFont.load_default(size=64)
    bbox = draw.textbbox((0, 0), label, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((900 - w) / 2 - bbox[0], (900 - h) / 2 - bbox[1]), label,
              fill="white", font=font)
    img.save(path)


def main():
    create_db_and_tables()

    # reset
    UPLOADS_DIR.mkdir(exist_ok=True)
    for f in UPLOADS_DIR.iterdir():
        if f.is_file():
            f.unlink()
    with Session(engine) as s:
        for model in (PostLike, Comment, Post, Match, Swipe, Prompt, Photo, User):
            s.exec(delete(model))
        s.commit()

        users, n_photos_total, n_prompts_total = [], 0, 0
        for i, (name, age, gender, interested_in, bio, location) in enumerate(USERS):
            u = User(name=name, age=age, bio=bio, location=location, gender=gender,
                     interested_in=interested_in, profile_complete=True)
            s.add(u)
            s.flush()
            users.append(u)

            initials = "".join(p[0] for p in name.split())[:2].upper()
            color = COLORS[i % len(COLORS)]
            # Real photos from seed-photos/<n>.<ext> and <n>-<k>.<ext> win
            # over generated avatars.
            provided = sorted(
                p for ext in ("jpg", "jpeg", "png", "webp")
                for p in SEED_PHOTOS_DIR.glob(f"{i + 1}*.{ext}")
            )
            n_photos = max(len(provided), 1 + (i % 2))
            n_photos_total += n_photos
            for j in range(n_photos):
                if j < len(provided):
                    src = provided[j]
                    # Content-hash the filename so clients' image caches
                    # (expo-image) can't serve a stale avatar for the same URL.
                    digest = hashlib.md5(src.read_bytes()).hexdigest()[:8]
                    fname = f"seed_{u.id}_{j}_{digest}{src.suffix}"
                    shutil.copy(src, UPLOADS_DIR / fname)
                else:
                    fname = f"seed_{u.id}_{j}.png"
                    make_avatar(UPLOADS_DIR / fname, initials,
                                color if j == 0 else shade(color, 0.75))
                s.add(Photo(user_id=u.id, path=fname, sort_order=j))

            keys = random.sample(list(PROMPT_ANSWERS), 3)
            for k in keys[: random.choice((2, 3))]:
                s.add(Prompt(user_id=u.id, prompt_key=k,
                             answer=random.choice(PROMPT_ANSWERS[k])))
                n_prompts_total += 1
        s.commit()

        ids = [u.id for u in users]
        # swipes: each user swipes on ~12 others, ~60% right
        swipes = []
        for a in ids:
            for b in random.sample([x for x in ids if x != a], 12):
                d = "right" if random.random() < 0.6 else "left"
                swipes.append(Swipe(swiper_id=a, swiped_id=b, direction=d))
                s.add(swipes[-1])
        s.commit()

        rights = {(sw.swiper_id, sw.swiped_id) for sw in swipes
                  if sw.direction == "right"}
        mutuals = sorted({tuple(sorted(p)) for p in rights
                          if (p[1], p[0]) in rights})
        for a, b in mutuals:
            s.add(Match(user_a=a, user_b=b))
        s.commit()

        # posts: each user gets 1-2, roughly half with an image
        posts = []
        for i, u in enumerate(users):
            for j in range(1 + (i % 2)):
                text = random.choice(POST_TEXTS)
                image_path = None
                if random.random() < 0.5:
                    image_path = f"seed_post_{u.id}_{j}.png"
                    make_post_image(UPLOADS_DIR / image_path,
                                    COLORS[(i + j) % len(COLORS)],
                                    u.name.upper())
                posts.append(Post(user_id=u.id, text=text, image_path=image_path))
                s.add(posts[-1])
        s.commit()

        # comments: 0-3 per post, some with a reply
        n_comments = n_replies = 0
        for post in posts:
            roots = []
            for _ in range(random.choice((0, 1, 2, 3))):
                c = Comment(post_id=post.id, user_id=random.choice(ids),
                            text=random.choice(POST_COMMENTS))
                s.add(c)
                s.flush()
                roots.append(c)
                n_comments += 1
            for root in roots:
                if random.random() < 0.4:
                    s.add(Comment(post_id=post.id, user_id=random.choice(ids),
                                  parent_id=root.id,
                                  text=random.choice(POST_REPLIES)))
                    n_replies += 1
        s.commit()

        post_ids = [p.id for p in posts]
        likes = set()
        while len(likes) < 60:
            likes.add((random.choice(ids), random.choice(post_ids)))
        for uid, pid in likes:
            s.add(PostLike(user_id=uid, post_id=pid))
        s.commit()

        print(f"users={len(users)} photos={n_photos_total} "
              f"prompts={n_prompts_total} swipes={len(swipes)} "
              f"matches={len(mutuals)} posts={len(posts)} "
              f"comments={n_comments} replies={n_replies} likes={len(likes)}")


if __name__ == "__main__":
    main()
