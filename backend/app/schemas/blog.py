"""
Blog Schemas - Request/Response models for blog API
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.blog import BlogStatus


class BlogCreate(BaseModel):
    """Schema for creating a new blog post"""
    title: str = Field(..., min_length=1, max_length=200)
    excerpt: Optional[str] = Field(None, max_length=500)
    content: str = Field(..., min_length=1)
    featured_image: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    meta_title: Optional[str] = Field(None, max_length=60)
    meta_description: Optional[str] = Field(None, max_length=160)
    status: BlogStatus = BlogStatus.DRAFT
    is_featured: bool = False


class BlogUpdate(BaseModel):
    """Schema for updating a blog post"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    excerpt: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = None
    featured_image: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    meta_title: Optional[str] = Field(None, max_length=60)
    meta_description: Optional[str] = Field(None, max_length=160)
    status: Optional[BlogStatus] = None
    is_featured: Optional[bool] = None


class BlogResponse(BaseModel):
    """Schema for blog response"""
    id: str
    title: str
    slug: str
    excerpt: Optional[str] = None
    content: str
    featured_image: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    author_id: str
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    status: BlogStatus
    is_featured: bool
    views: int
    likes: int
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None


class BlogListResponse(BaseModel):
    """Schema for blog list item (without full content)"""
    id: str
    title: str
    slug: str
    excerpt: Optional[str] = None
    featured_image: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    author_name: Optional[str] = None
    author_avatar: Optional[str] = None
    status: BlogStatus
    is_featured: bool
    views: int
    likes: int
    created_at: datetime
    published_at: Optional[datetime] = None


class BlogListPaginated(BaseModel):
    """Paginated blog list response"""
    blogs: List[BlogListResponse]
    total: int
    page: int
    per_page: int
    total_pages: int
