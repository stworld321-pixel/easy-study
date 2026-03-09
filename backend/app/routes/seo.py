from fastapi import APIRouter, Response

from app.models.tutor import TutorProfile
from app.utils.seo import build_tutor_slug

router = APIRouter(tags=["SEO"])


def _build_tutor_sitemap_xml(tutors: list[TutorProfile]) -> str:
    entries = []
    for tutor in tutors:
        slug = build_tutor_slug(tutor.full_name or "", tutor.subjects or [], tutor.city)
        lastmod = (tutor.updated_at or tutor.created_at).date().isoformat()
        entries.append(
            f"<url><loc>https://easystudy.cloud/tutors/{slug}</loc><lastmod>{lastmod}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>"
        )

    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + "".join(entries)
        + "</urlset>"
    )


@router.get("/sitemap-tutors.xml")
async def tutor_sitemap():
    tutors = await TutorProfile.find_all().to_list()
    xml = _build_tutor_sitemap_xml(tutors)
    return Response(content=xml, media_type="application/xml")


@router.get("/sitemap.xml")
async def legacy_tutor_sitemap():
    # Backward compatibility for existing robots/search console entries.
    tutors = await TutorProfile.find_all().to_list()
    xml = _build_tutor_sitemap_xml(tutors)
    return Response(content=xml, media_type="application/xml")
