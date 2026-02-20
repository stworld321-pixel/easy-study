"""
Blog Routes - API endpoints for blog management
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime
from math import ceil

from app.models.blog import Blog, BlogStatus
from app.models.user import User
from app.schemas.blog import (
    BlogCreate, BlogUpdate, BlogResponse,
    BlogListResponse, BlogListPaginated
)
from app.routes.auth import get_current_user

router = APIRouter(prefix="/blogs", tags=["Blogs"])


def blog_to_response(blog: Blog) -> BlogResponse:
    """Convert Blog model to BlogResponse"""
    return BlogResponse(
        id=str(blog.id),
        title=blog.title,
        slug=blog.slug,
        excerpt=blog.excerpt,
        content=blog.content,
        featured_image=blog.featured_image,
        category=blog.category,
        tags=blog.tags,
        author_id=blog.author_id,
        author_name=blog.author_name,
        author_avatar=blog.author_avatar,
        meta_title=blog.meta_title,
        meta_description=blog.meta_description,
        status=blog.status,
        is_featured=blog.is_featured,
        views=blog.views,
        likes=blog.likes,
        created_at=blog.created_at,
        updated_at=blog.updated_at,
        published_at=blog.published_at
    )


def blog_to_list_response(blog: Blog) -> BlogListResponse:
    """Convert Blog model to BlogListResponse (without content)"""
    return BlogListResponse(
        id=str(blog.id),
        title=blog.title,
        slug=blog.slug,
        excerpt=blog.excerpt,
        featured_image=blog.featured_image,
        category=blog.category,
        tags=blog.tags,
        author_name=blog.author_name,
        author_avatar=blog.author_avatar,
        status=blog.status,
        is_featured=blog.is_featured,
        views=blog.views,
        likes=blog.likes,
        created_at=blog.created_at,
        published_at=blog.published_at
    )


# ============================================
# Public Routes
# ============================================

@router.get("/public", response_model=BlogListPaginated)
async def get_public_blogs(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    category: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    featured: Optional[bool] = None
):
    """Get published blogs (public access)"""
    query = {"status": BlogStatus.PUBLISHED}

    if category:
        query["category"] = category
    if tag:
        query["tags"] = tag
    if featured is not None:
        query["is_featured"] = featured
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"excerpt": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}}
        ]

    total = await Blog.find(query).count()
    total_pages = ceil(total / per_page)

    blogs = await Blog.find(query).sort("-published_at").skip((page - 1) * per_page).limit(per_page).to_list()

    return BlogListPaginated(
        blogs=[blog_to_list_response(b) for b in blogs],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


@router.get("/public/{slug}", response_model=BlogResponse)
async def get_public_blog_by_slug(slug: str):
    """Get a published blog by slug (public access)"""
    blog = await Blog.find_one({"slug": slug, "status": BlogStatus.PUBLISHED})
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    # Increment view count
    blog.views += 1
    await blog.save()

    return blog_to_response(blog)


@router.get("/public/categories/list")
async def get_blog_categories():
    """Get list of all categories with blog counts"""
    blogs = await Blog.find({"status": BlogStatus.PUBLISHED}).to_list()

    categories = {}
    for blog in blogs:
        if blog.category:
            categories[blog.category] = categories.get(blog.category, 0) + 1

    return [{"name": k, "count": v} for k, v in sorted(categories.items())]


@router.get("/public/tags/list")
async def get_blog_tags():
    """Get list of all tags with blog counts"""
    blogs = await Blog.find({"status": BlogStatus.PUBLISHED}).to_list()

    tags = {}
    for blog in blogs:
        for tag in blog.tags:
            tags[tag] = tags.get(tag, 0) + 1

    return [{"name": k, "count": v} for k, v in sorted(tags.items(), key=lambda x: -x[1])]


@router.post("/public/{slug}/like")
async def like_blog(slug: str):
    """Like a blog post"""
    blog = await Blog.find_one({"slug": slug, "status": BlogStatus.PUBLISHED})
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    blog.likes += 1
    await blog.save()

    return {"likes": blog.likes}


# ============================================
# Admin Routes
# ============================================

@router.get("", response_model=List[BlogListResponse])
async def get_all_blogs(
    current_user: User = Depends(get_current_user),
    status: Optional[BlogStatus] = None
):
    """Get all blogs (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    query = {}
    if status:
        query["status"] = status

    blogs = await Blog.find(query).sort("-created_at").to_list()
    return [blog_to_list_response(b) for b in blogs]


@router.get("/{blog_id}", response_model=BlogResponse)
async def get_blog(
    blog_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a specific blog (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    blog = await Blog.get(blog_id)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    return blog_to_response(blog)


@router.post("", response_model=BlogResponse)
async def create_blog(
    blog_data: BlogCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new blog post (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    # Generate slug from title
    base_slug = Blog.generate_slug(blog_data.title)
    slug = base_slug

    # Ensure slug is unique
    counter = 1
    while await Blog.find_one({"slug": slug}):
        slug = f"{base_slug}-{counter}"
        counter += 1

    blog = Blog(
        title=blog_data.title,
        slug=slug,
        excerpt=blog_data.excerpt,
        content=blog_data.content,
        featured_image=blog_data.featured_image,
        category=blog_data.category,
        tags=blog_data.tags,
        author_id=str(current_user.id),
        author_name=current_user.full_name,
        author_avatar=getattr(current_user, 'avatar', None),
        meta_title=blog_data.meta_title or blog_data.title[:60],
        meta_description=blog_data.meta_description or (blog_data.excerpt[:160] if blog_data.excerpt else None),
        status=blog_data.status,
        is_featured=blog_data.is_featured,
        published_at=datetime.utcnow() if blog_data.status == BlogStatus.PUBLISHED else None
    )

    await blog.insert()
    return blog_to_response(blog)


@router.put("/{blog_id}", response_model=BlogResponse)
async def update_blog(
    blog_id: str,
    blog_data: BlogUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a blog post (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    blog = await Blog.get(blog_id)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    # Update fields
    update_data = blog_data.dict(exclude_unset=True)

    # If title changed, regenerate slug
    if "title" in update_data and update_data["title"] != blog.title:
        base_slug = Blog.generate_slug(update_data["title"])
        slug = base_slug
        counter = 1
        while await Blog.find_one({"slug": slug, "_id": {"$ne": blog.id}}):
            slug = f"{base_slug}-{counter}"
            counter += 1
        update_data["slug"] = slug

    # Handle status change to published
    if "status" in update_data:
        if update_data["status"] == BlogStatus.PUBLISHED and blog.status != BlogStatus.PUBLISHED:
            update_data["published_at"] = datetime.utcnow()

    update_data["updated_at"] = datetime.utcnow()

    for field, value in update_data.items():
        setattr(blog, field, value)

    await blog.save()
    return blog_to_response(blog)


@router.delete("/{blog_id}")
async def delete_blog(
    blog_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a blog post (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    blog = await Blog.get(blog_id)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    await blog.delete()
    return {"message": "Blog deleted successfully"}


@router.post("/{blog_id}/publish", response_model=BlogResponse)
async def publish_blog(
    blog_id: str,
    current_user: User = Depends(get_current_user)
):
    """Publish a draft blog (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    blog = await Blog.get(blog_id)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    blog.status = BlogStatus.PUBLISHED
    blog.published_at = datetime.utcnow()
    blog.updated_at = datetime.utcnow()
    await blog.save()

    return blog_to_response(blog)


@router.post("/{blog_id}/unpublish", response_model=BlogResponse)
async def unpublish_blog(
    blog_id: str,
    current_user: User = Depends(get_current_user)
):
    """Unpublish a blog (set to draft) (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    blog = await Blog.get(blog_id)
    if not blog:
        raise HTTPException(status_code=404, detail="Blog not found")

    blog.status = BlogStatus.DRAFT
    blog.updated_at = datetime.utcnow()
    await blog.save()

    return blog_to_response(blog)
