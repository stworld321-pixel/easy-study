"""
Blog Model - For managing blog posts
"""

from beanie import Document, Indexed
from pydantic import Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class BlogStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class Blog(Document):
    """Blog post model"""

    # Basic info
    title: Indexed(str)
    slug: Indexed(str, unique=True)  # URL-friendly version of title
    excerpt: Optional[str] = None  # Short summary for listings
    content: str  # Full blog content (HTML/Markdown)

    # Media
    featured_image: Optional[str] = None  # URL to featured image

    # Categorization
    category: Optional[str] = None
    tags: List[str] = []

    # Author info
    author_id: str
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None

    # SEO
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None

    # Status and visibility
    status: BlogStatus = BlogStatus.DRAFT
    is_featured: bool = False

    # Engagement
    views: int = 0
    likes: int = 0

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    published_at: Optional[datetime] = None

    class Settings:
        name = "blogs"

    @staticmethod
    def generate_slug(title: str) -> str:
        """Generate URL-friendly slug from title"""
        import re
        slug = title.lower().strip()
        slug = re.sub(r'[^\w\s-]', '', slug)
        slug = re.sub(r'[\s_-]+', '-', slug)
        slug = re.sub(r'^-+|-+$', '', slug)
        return slug
