import re
import unicodedata
from typing import Iterable


def slugify_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    lowered = normalized.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", lowered).strip("-")
    return slug


def build_tutor_slug(full_name: str, subjects: Iterable[str], city: str | None) -> str:
    subject_list = list(subjects or [])
    primary_subject = subject_list[0] if subject_list else "general"
    return "-".join(
        part
        for part in [
            slugify_text(full_name or "tutor"),
            slugify_text(primary_subject),
            "tutor",
            slugify_text(city or "online"),
        ]
        if part
    )

