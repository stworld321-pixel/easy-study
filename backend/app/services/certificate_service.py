from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.utils import ImageReader


def build_certificate_pdf(
    student_name: str,
    tutor_name: str,
    subject: str,
    session_date: datetime,
    certificate_number: str,
    session_name: str | None = None,
    tutor_signature_url: str | None = None,
    tutor_signature_bytes: bytes | None = None,
) -> bytes:
    """
    Build a certificate PDF and return bytes.
    """
    buffer = BytesIO()
    page_width, page_height = landscape(A4)
    c = canvas.Canvas(buffer, pagesize=(page_width, page_height))

    # Palette
    blue_dark = colors.HexColor("#0f3d8a")
    blue_mid = colors.HexColor("#1f4ea3")
    blue_ribbon = colors.HexColor("#12397c")
    gold = colors.HexColor("#d5a94f")
    gold_light = colors.HexColor("#f1d486")
    text_dark = colors.HexColor("#161616")
    text_muted = colors.HexColor("#555555")

    # Background and borders
    c.setFillColor(colors.white)
    c.rect(0, 0, page_width, page_height, stroke=0, fill=1)

    c.setStrokeColor(gold)
    c.setLineWidth(10)
    c.rect(16, 16, page_width - 32, page_height - 32, stroke=1, fill=0)

    c.setStrokeColor(colors.HexColor("#d8d8d8"))
    c.setLineWidth(2)
    c.rect(30, 30, page_width - 60, page_height - 60, stroke=1, fill=0)

    # Left decorative strip
    c.setFillColor(blue_dark)
    c.rect(30, 30, 78, page_height - 60, stroke=0, fill=1)

    c.setFillColor(blue_mid)
    c.rect(66, 30, 42, page_height - 60, stroke=0, fill=1)

    c.setFillColor(gold)
    c.rect(108, 30, 12, page_height - 60, stroke=0, fill=1)

    c.setFillColor(gold_light)
    c.rect(120, 30, 8, page_height - 60, stroke=0, fill=1)

    # Left medal
    medal_x = 92
    medal_y = page_height - 155
    c.setFillColor(gold_light)
    c.circle(medal_x, medal_y, 44, stroke=0, fill=1)
    c.setFillColor(gold)
    c.circle(medal_x, medal_y, 36, stroke=0, fill=1)
    c.setFillColor(colors.HexColor("#fff0b8"))
    c.circle(medal_x, medal_y, 20, stroke=0, fill=1)

    c.setFillColor(blue_ribbon)
    left_ribbon = c.beginPath()
    left_ribbon.moveTo(medal_x - 24, medal_y - 42)
    left_ribbon.lineTo(medal_x - 4, medal_y - 92)
    left_ribbon.lineTo(medal_x - 34, medal_y - 92)
    left_ribbon.close()
    c.drawPath(left_ribbon, stroke=0, fill=1)

    right_ribbon = c.beginPath()
    right_ribbon.moveTo(medal_x + 24, medal_y - 42)
    right_ribbon.lineTo(medal_x + 34, medal_y - 92)
    right_ribbon.lineTo(medal_x + 4, medal_y - 92)
    right_ribbon.close()
    c.drawPath(right_ribbon, stroke=0, fill=1)

    # Title
    c.setFillColor(text_dark)
    c.setFont("Times-Bold", 48)
    c.drawCentredString(page_width / 2 + 28, page_height - 118, "CERTIFICATE")

    c.setFillColor(text_dark)
    c.setFont("Helvetica-Oblique", 24)
    c.drawCentredString(page_width / 2 + 28, page_height - 156, "OF APPRECIATION")

    # Subject row
    center_x = page_width / 2 + 28
    c.setFillColor(text_dark)
    c.setFont("Helvetica-Bold", 12)
    title_text = (session_name or subject or "").strip() or "SESSION COURSE"
    c.drawCentredString(center_x, page_height - 194, f"SESSION COURSE NAME: {title_text.upper()}")

    # Intro text
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(center_x, page_height - 246, "THIS IS TO CERTIFY THAT")

    # Student name
    safe_name = (student_name or "").strip() or "STUDENT"
    c.setFillColor(colors.HexColor("#2d2d2d"))
    c.setFont("Times-BoldItalic", 40)
    c.drawCentredString(center_x, page_height - 304, safe_name.upper())

    # Separator line
    c.setStrokeColor(gold)
    c.setLineWidth(2)
    c.line(250, page_height - 322, page_width - 90, page_height - 322)

    # Main description
    date_text = session_date.strftime("%B %d, %Y")
    body_text = (
        f"has actively participated in the one hour online session on "
        f"\"{title_text}\" conducted by {tutor_name} on {date_text}."
    )
    c.setFillColor(text_muted)
    c.setFont("Helvetica", 16)
    max_width = page_width - 420
    words = body_text.split()
    lines = []
    line = ""
    for word in words:
        trial = f"{line} {word}".strip()
        if stringWidth(trial, "Helvetica", 16) <= max_width:
            line = trial
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)

    text_y = page_height - 370
    for idx, text_line in enumerate(lines):
        c.drawCentredString(center_x, text_y - (idx * 22), text_line)

    # Signature block (placed below body with safe gap to prevent overlap)
    last_body_line_y = text_y - ((max(len(lines), 1) - 1) * 22)
    sig_line_y = min(last_body_line_y - 32, 132)  # keep lower than body and inside page
    sig_name_y = sig_line_y - 26
    sig_role_y = sig_name_y - 22

    c.setStrokeColor(colors.HexColor("#444444"))
    c.setLineWidth(1)
    sig_left = center_x - 170
    sig_right = center_x + 170
    c.line(sig_left, sig_line_y, sig_right, sig_line_y)
    signature_drawn = False
    signature_raw = tutor_signature_bytes
    if not signature_raw and tutor_signature_url:
        try:
            from urllib.request import urlopen
            with urlopen(tutor_signature_url, timeout=5) as response:
                signature_raw = response.read()
        except Exception:
            signature_raw = None

    if signature_raw:
        try:
            signature_img = ImageReader(BytesIO(signature_raw))
            c.drawImage(
                signature_img,
                center_x - 110,
                sig_name_y - 6,
                width=220,
                height=44,
                preserveAspectRatio=True,
                mask="auto",
                anchor="sw",
            )
            signature_drawn = True
        except Exception:
            signature_drawn = False

    c.setFillColor(text_dark)
    c.setFont("Helvetica-Bold", 16)
    if not signature_drawn:
        c.drawCentredString(center_x, sig_name_y, tutor_name.upper())
    else:
        c.drawCentredString(center_x, sig_name_y - 14, tutor_name.upper())
    c.setFont("Helvetica", 13)
    c.setFillColor(text_muted)
    c.drawCentredString(center_x, sig_role_y, "Session Tutor")

    # Brand block
    c.setFillColor(colors.HexColor("#6a7bff"))
    c.roundRect(page_width - 260, 86, 46, 46, 8, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(page_width - 237, 98, "Z")
    c.setFillColor(colors.HexColor("#555555"))
    c.setFont("Helvetica-Bold", 22)
    c.drawString(page_width - 205, 97, "Zeal Catalyst")

    # Footer
    c.setFillColor(colors.HexColor("#4b5563"))
    c.setFont("Helvetica", 11)
    c.drawString(250, 58, f"Certificate No: {certificate_number}")
    c.drawRightString(page_width - 88, 58, f"Issued On: {datetime.utcnow().strftime('%d %b %Y')}")

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.read()
