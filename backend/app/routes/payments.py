"""
Payment Routes - Razorpay Integration
"""

from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import logging
import asyncio
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.pdfbase.pdfmetrics import stringWidth
from app.models.user import User
from app.models.booking import Booking
from app.models.payment import Payment, PaymentStatus
from app.models.platform_settings import PlatformSettings
from app.models.tutor import TutorProfile
from app.routes.auth import get_current_user
from app.services.razorpay_service import razorpay_service
from app.services.payment_service import payment_service
from app.services.email_service import email_service
from app.schemas.booking import UtcDatetime
from app.core.config import settings

router = APIRouter(prefix="/payments", tags=["Payments"])
logger = logging.getLogger(__name__)
MIN_ORDER_AMOUNT = 1.0


def _build_in_app_meeting_link(booking: Booking) -> str:
    base = (settings.FRONTEND_URL or "").rstrip("/")
    if not base:
        base = "http://localhost:5173"
    return f"{base}/meeting/{booking.id}"


def _dispatch_background(coro, context: str) -> None:
    async def _runner():
        try:
            await coro
        except Exception:
            logger.exception("Background task failed (%s)", context)

    asyncio.create_task(_runner())


# --- Schemas ---
class CreateOrderRequest(BaseModel):
    booking_id: str


class CreateOrderResponse(BaseModel):
    success: bool
    order_id: Optional[str] = None
    amount: Optional[int] = None
    currency: Optional[str] = None
    key_id: Optional[str] = None
    payment_id: Optional[str] = None
    error: Optional[str] = None


class VerifyPaymentRequest(BaseModel):
    booking_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class PaymentDetailsResponse(BaseModel):
    id: str
    booking_id: str
    session_amount: float
    currency: str
    admission_fee: float
    commission_fee: float
    total_platform_fee: float
    tutor_earnings: float
    status: str
    is_first_booking: bool
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    created_at: UtcDatetime


class TutorPaymentListItem(BaseModel):
    id: str
    booking_id: str
    student_name: str
    scheduled_at: Optional[UtcDatetime] = None
    session_amount: float
    tutor_earnings: float
    currency: str
    status: str
    created_at: UtcDatetime


@router.post("/create-order", response_model=CreateOrderResponse)
async def create_razorpay_order(
    request: CreateOrderRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Create a Razorpay order for a booking.
    This should be called before initiating the payment.
    """
    # Get the booking
    booking = await Booking.get(request.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Verify the user owns this booking
    if booking.student_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get or create payment record
    payment = await payment_service.get_payment_by_booking(request.booking_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    # If payment already completed, return error
    if payment.status == PaymentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Payment already completed")

    charge_amount = payment.charge_amount if payment.charge_amount and payment.charge_amount > 0 else payment.session_amount

    # Guard before hitting Razorpay API.
    if charge_amount < MIN_ORDER_AMOUNT:
        return CreateOrderResponse(
            success=False,
            error=(
                f"Order amount ({payment.currency} {charge_amount:.2f}) is below minimum allowed "
                f"({payment.currency} {MIN_ORDER_AMOUNT:.2f})."
            )
        )

    # Create Razorpay order
    order_result = razorpay_service.create_order(
        amount=charge_amount,
        currency=payment.currency,
        receipt=f"booking_{request.booking_id}",
        notes={
            "booking_id": request.booking_id,
            "student_id": str(current_user.id),
            "student_email": current_user.email
        }
    )

    if not order_result["success"]:
        return CreateOrderResponse(
            success=False,
            error=order_result.get("error", "Failed to create order")
        )

    # Update payment with Razorpay order ID
    payment.razorpay_order_id = order_result["order_id"]
    await payment.save()

    return CreateOrderResponse(
        success=True,
        order_id=order_result["order_id"],
        amount=order_result["amount"],
        currency=order_result["currency"],
        key_id=order_result["key_id"],
        payment_id=str(payment.id)
    )


@router.post("/verify")
async def verify_razorpay_payment(
    request: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Verify Razorpay payment after successful payment.
    This completes the payment and confirms the booking.
    """
    # Get the booking
    booking = await Booking.get(request.booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Verify the user owns this booking
    if booking.student_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get payment record
    payment = await payment_service.get_payment_by_booking(request.booking_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    # Verify the order ID matches
    if payment.razorpay_order_id != request.razorpay_order_id:
        raise HTTPException(status_code=400, detail="Order ID mismatch")

    # Verify signature
    is_valid = razorpay_service.verify_payment(
        request.razorpay_order_id,
        request.razorpay_payment_id,
        request.razorpay_signature
    )

    if not is_valid:
        payment.status = PaymentStatus.FAILED
        await payment.save()
        raise HTTPException(status_code=400, detail="Payment verification failed")

    # Update payment record
    payment.razorpay_payment_id = request.razorpay_payment_id
    payment.razorpay_signature = request.razorpay_signature
    payment.status = PaymentStatus.COMPLETED
    payment.completed_at = datetime.utcnow()
    await payment.save()

    # Update booking status to indicate payment received
    booking.payment_status = "paid"
    await booking.save()

    workshop_confirmed = False
    is_workshop_booking = bool(getattr(booking, "is_workshop", False)) or "workshop booking:" in (booking.notes or "").lower()
    if is_workshop_booking:
        workshop_confirmed = booking.status != BookingStatus.CONFIRMED
        booking.status = BookingStatus.CONFIRMED
        if not booking.meeting_room_key:
            workshop_key_source = (booking.session_name or booking.subject or str(booking.id)).strip()
            booking.meeting_room_key = f"zc-w-{workshop_key_source}".lower().replace(" ", "-")
        booking.meeting_provider = "jitsi"
        booking.meeting_origin = "workshop_payment"
        booking.meeting_link = _build_in_app_meeting_link(booking)
        booking.updated_at = datetime.utcnow()
        await booking.save()

        if workshop_confirmed and booking.student_email:
            _dispatch_background(
                email_service.send_booking_confirmed_email(
                    to_email=booking.student_email,
                    student_name=booking.student_name or current_user.full_name or "Student",
                    tutor_name=booking.tutor_name or "Tutor",
                    subject_name=booking.subject,
                    scheduled_at=booking.scheduled_at,
                    meeting_link=booking.meeting_link,
                ),
                "workshop_booking_confirmed_email",
            )

    # Send paid invoice email in background. SMTP timeout must not block payment success response.
    total_paid = payment.charge_amount if payment.charge_amount and payment.charge_amount > 0 else payment.session_amount
    _dispatch_background(
        email_service.send_payment_invoice_email_with_retry(
            to_email=current_user.email,
            student_name=current_user.full_name or "Student",
            booking_id=str(booking.id),
            payment_id=str(payment.id),
            subject_name=booking.subject,
            tutor_name=booking.tutor_name or "Tutor",
            scheduled_at=booking.scheduled_at,
            currency=payment.currency,
            session_amount=payment.session_amount,
            platform_fee=payment.student_platform_fee,
            total_paid=total_paid,
            razorpay_payment_id=payment.razorpay_payment_id,
        ),
        "invoice_after_payment_verify",
    )

    return {
        "success": True,
        "message": "Payment verified successfully",
        "payment_id": str(payment.id),
        "booking_id": request.booking_id
    }


@router.get("/booking/{booking_id}", response_model=PaymentDetailsResponse)
async def get_payment_details(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get payment details for a booking"""
    # Get the booking
    booking = await Booking.get(booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Verify authorization
    if booking.student_id != str(current_user.id) and booking.tutor_id != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get payment record
    payment = await payment_service.get_payment_by_booking(booking_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")

    return PaymentDetailsResponse(
        id=str(payment.id),
        booking_id=payment.booking_id,
        session_amount=payment.session_amount,
        currency=payment.currency,
        admission_fee=payment.admission_fee,
        commission_fee=payment.commission_fee,
        total_platform_fee=payment.total_platform_fee,
        tutor_earnings=payment.tutor_earnings,
        status=payment.status.value if hasattr(payment.status, 'value') else payment.status,
        is_first_booking=payment.is_first_booking,
        razorpay_order_id=payment.razorpay_order_id,
        razorpay_payment_id=payment.razorpay_payment_id,
        created_at=payment.created_at
    )


@router.get("/my-payments")
async def get_my_payments(current_user: User = Depends(get_current_user)):
    """Get all payments for the current user"""
    payments = await Payment.find(
        Payment.student_id == str(current_user.id)
    ).sort("-created_at").to_list()

    return [
        {
            "id": str(p.id),
            "booking_id": p.booking_id,
            "session_amount": p.session_amount,
            "currency": p.currency,
            "total_platform_fee": p.total_platform_fee,
            "status": p.status.value if hasattr(p.status, 'value') else p.status,
            "created_at": p.created_at
        }
        for p in payments
    ]


@router.get("/tutor/list", response_model=list[TutorPaymentListItem])
async def get_tutor_payments(current_user: User = Depends(get_current_user)):
    if current_user.role != "tutor":
        raise HTTPException(status_code=403, detail="Only tutors can access this")

    tutor_profile = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor_profile:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    tutor_id = str(tutor_profile.id)
    payments = await Payment.find(
        Payment.tutor_id == tutor_id
    ).sort("-created_at").to_list()

    booking_map = {}
    for p in payments:
        if not p.booking_id:
            continue
        if p.booking_id in booking_map:
            continue
        booking_map[p.booking_id] = await Booking.get(p.booking_id)

    items: list[TutorPaymentListItem] = []
    for p in payments:
        booking = booking_map.get(p.booking_id)
        items.append(TutorPaymentListItem(
            id=str(p.id),
            booking_id=p.booking_id,
            student_name=(booking.student_name if booking and booking.student_name else "Student"),
            scheduled_at=(booking.scheduled_at if booking else None),
            session_amount=p.session_amount,
            tutor_earnings=p.tutor_earnings,
            currency=p.currency,
            status=p.status.value if hasattr(p.status, "value") else str(p.status),
            created_at=p.created_at,
        ))
    return items


@router.get("/tutor/invoice/{payment_id}")
async def download_tutor_invoice(payment_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "tutor":
        raise HTTPException(status_code=403, detail="Only tutors can access this")

    tutor_profile = await TutorProfile.find_one(TutorProfile.user_id == str(current_user.id))
    if not tutor_profile:
        raise HTTPException(status_code=404, detail="Tutor profile not found")

    payment = await Payment.get(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment.tutor_id != str(tutor_profile.id):
        raise HTTPException(status_code=403, detail="Not authorized")

    booking = await Booking.get(payment.booking_id) if payment.booking_id else None
    student_name = booking.student_name if booking and booking.student_name else "Student"
    tutor_name = booking.tutor_name if booking and booking.tutor_name else (tutor_profile.full_name or "Tutor")
    subject_name = booking.subject if booking and booking.subject else "-"
    scheduled_at = booking.scheduled_at.strftime("%d %b %Y, %I:%M %p UTC") if booking and booking.scheduled_at else "-"
    status = payment.status.value if hasattr(payment.status, "value") else str(payment.status)
    completed_at = payment.completed_at.strftime("%d %b %Y, %I:%M %p UTC") if payment.completed_at else "-"
    created_at = payment.created_at.strftime("%d %b %Y, %I:%M %p UTC")
    issue_date = datetime.utcnow()
    due_date = issue_date + timedelta(days=7)
    issue_date_text = issue_date.strftime("%d %b %Y")
    due_date_text = due_date.strftime("%d %b %Y")
    duration_hours = round((booking.duration_minutes or 60) / 60, 2) if booking and booking.duration_minutes else 1.0
    line_rate = payment.session_amount / duration_hours if duration_hours else payment.session_amount
    item_description = f"{subject_name} session with {student_name}"

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    margin = 38
    content_width = width - (margin * 2)
    header_h = 96
    blue = colors.HexColor("#1f6a8a")
    blue_dark = colors.HexColor("#15546e")
    text_dark = colors.HexColor("#1f2937")
    text_muted = colors.HexColor("#6b7280")
    line = colors.HexColor("#d1d5db")
    soft = colors.HexColor("#f8fafc")
    border = colors.HexColor("#cbd5e1")
    accent = colors.HexColor("#0f4c5c")

    def wrap_text(value: str, font_name: str, font_size: float, max_width: float) -> list[str]:
        words = (value or "").split()
        if not words:
            return [""]
        lines = []
        current = words[0]
        for word in words[1:]:
            trial = f"{current} {word}"
            if stringWidth(trial, font_name, font_size) <= max_width:
                current = trial
            else:
                lines.append(current)
                current = word
        lines.append(current)
        return lines

    def draw_kv(label: str, value: str, x: float, y: float, value_font: str = "Helvetica-Bold", value_size: int = 10):
        pdf.setFillColor(text_muted)
        pdf.setFont("Helvetica", 9)
        pdf.drawString(x, y, label)
        pdf.setFillColor(text_dark)
        pdf.setFont(value_font, value_size)
        pdf.drawString(x + 110, y, value)

    # Background
    pdf.setFillColor(colors.white)
    pdf.rect(0, 0, width, height, stroke=0, fill=1)

    # Header bar
    pdf.setFillColor(blue)
    pdf.rect(0, height - header_h, width, header_h, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 28)
    pdf.drawString(margin, height - 56, "INVOICE")
    pdf.setFont("Helvetica", 10)
    pdf.drawString(margin, height - 72, "Payment invoice for completed tutoring session")

    # Brand / company block
    brand_x = width - margin - 180
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawRightString(width - margin, height - 24, "Zeal Catalyst")
    pdf.setFont("Helvetica", 8.5)
    pdf.drawRightString(width - margin, height - 38, "Online Tutoring Platform")
    pdf.drawRightString(width - margin, height - 50, "support@zealcatalyst.com")
    pdf.drawRightString(width - margin, height - 62, "easystudy.cloud")

    # Logo mark
    pdf.setFillColor(colors.white)
    pdf.roundRect(brand_x, height - 70, 30, 30, 7, stroke=0, fill=1)
    pdf.setFillColor(blue)
    pdf.roundRect(brand_x + 3, height - 67, 24, 24, 6, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawCentredString(brand_x + 15, height - 60, "Z")

    # Meta row
    top_y = height - 118
    pdf.setStrokeColor(line)
    pdf.setLineWidth(1)
    pdf.line(margin, top_y - 4, width - margin, top_y - 4)

    draw_kv("Invoice No.", f"INV-{payment_id}", margin, top_y - 24)
    draw_kv("Date of Issue", issue_date_text, margin, top_y - 42)
    draw_kv("Due Date", due_date_text, margin, top_y - 60)

    pdf.setFillColor(text_dark)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawRightString(width - margin, top_y - 24, "Bill To")
    pdf.setFont("Helvetica", 9)
    pdf.drawRightString(width - margin, top_y - 40, tutor_name if tutor_name else "Tutor")
    pdf.drawRightString(width - margin, top_y - 54, f"Student: {student_name}")
    pdf.drawRightString(width - margin, top_y - 68, booking.student_id if booking else booking_id)

    # Details panels
    details_y = top_y - 108
    left_panel_h = 88
    right_panel_h = 88
    pdf.setStrokeColor(border)
    pdf.setFillColor(colors.white)
    pdf.roundRect(margin, details_y - left_panel_h + 8, content_width * 0.56, left_panel_h, 8, stroke=1, fill=1)
    pdf.roundRect(margin + content_width * 0.58, details_y - right_panel_h + 8, content_width * 0.42, right_panel_h, 8, stroke=1, fill=1)

    pdf.setFillColor(text_dark)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(margin + 12, details_y - 8, "Booking Details")
    pdf.drawString(margin + content_width * 0.58 + 12, details_y - 8, "Payment Details")
    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(text_muted)
    pdf.drawString(margin + 12, details_y - 26, f"Tutor: {tutor_name}")
    pdf.drawString(margin + 12, details_y - 40, f"Session: {subject_name}")
    pdf.drawString(margin + 12, details_y - 54, f"Date & Time: {scheduled_at}")
    pdf.drawString(margin + 12, details_y - 68, f"Status: {status.title()}")

    pdf.setFillColor(text_muted)
    pdf.drawString(margin + content_width * 0.58 + 12, details_y - 26, f"Payment ID: {payment.razorpay_payment_id or '-'}")
    pdf.drawString(margin + content_width * 0.58 + 12, details_y - 40, f"Booking ID: {payment.booking_id}")
    pdf.drawString(margin + content_width * 0.58 + 12, details_y - 54, f"Issued: {created_at}")
    pdf.drawString(margin + content_width * 0.58 + 12, details_y - 68, f"Completed: {completed_at}")

    # Items table
    table_top = details_y - 108
    table_left = margin
    table_right = width - margin
    col_widths = [26, 240, 56, 72, 90]
    table_width = sum(col_widths)
    if table_width > content_width:
        scale = content_width / table_width
        col_widths = [w * scale for w in col_widths]
        table_width = sum(col_widths)
    x_positions = [table_left]
    for w in col_widths[:-1]:
        x_positions.append(x_positions[-1] + w)

    pdf.setFillColor(colors.HexColor("#eef2f7"))
    pdf.rect(table_left, table_top - 22, table_width, 22, stroke=0, fill=1)
    pdf.setStrokeColor(line)
    pdf.rect(table_left, table_top - 22, table_width, 22, stroke=1, fill=0)
    headers = ["#", "Item", "Hours", "Rate", "Amount"]
    pdf.setFillColor(text_dark)
    pdf.setFont("Helvetica-Bold", 9)
    for idx, header in enumerate(headers):
        if idx == 0:
            pdf.drawCentredString(x_positions[idx] + col_widths[idx] / 2, table_top - 14, header)
        elif idx == 1:
            pdf.drawString(x_positions[idx] + 6, table_top - 14, header)
        else:
            pdf.drawCentredString(x_positions[idx] + col_widths[idx] / 2, table_top - 14, header)

    row_y = table_top - 22
    row_h = 34
    pdf.setStrokeColor(line)
    pdf.rect(table_left, row_y - row_h, table_width, row_h, stroke=1, fill=0)
    pdf.setFillColor(text_dark)
    pdf.setFont("Helvetica", 9)
    pdf.drawCentredString(x_positions[0] + col_widths[0] / 2, row_y - 18, "1")

    item_lines = wrap_text(item_description, "Helvetica", 9, col_widths[1] - 12)
    pdf.setFont("Helvetica", 9)
    item_text_y = row_y - 14
    for line_text in item_lines[:2]:
        pdf.drawString(x_positions[1] + 6, item_text_y, line_text)
        item_text_y -= 10

    pdf.drawCentredString(x_positions[2] + col_widths[2] / 2, row_y - 18, f"{duration_hours:g}")
    pdf.drawCentredString(x_positions[3] + col_widths[3] / 2, row_y - 18, f"{payment.currency} {line_rate:.2f}")
    pdf.drawCentredString(x_positions[4] + col_widths[4] / 2, row_y - 18, f"{payment.currency} {payment.session_amount:.2f}")

    # Extra blank table rows for sample-like layout
    blank_rows = 4
    current_top = row_y - row_h
    for _ in range(blank_rows):
        pdf.rect(table_left, current_top - row_h, table_width, row_h, stroke=1, fill=0)
        current_top -= row_h

    # Summary block
    summary_top = current_top - 18
    summary_x = width - margin - 215
    summary_w = 215
    summary_h = 112
    pdf.setFillColor(soft)
    pdf.setStrokeColor(border)
    pdf.roundRect(summary_x, summary_top - summary_h, summary_w, summary_h, 8, stroke=1, fill=1)

    subtotal = payment.session_amount
    discount = 0.0
    tax_rate = 0.0
    tax_amount = 0.0
    total = subtotal - discount + tax_amount

    summary_rows = [
        ("Subtotal", f"{payment.currency} {subtotal:.2f}"),
        ("Discount", f"{payment.currency} {discount:.2f}"),
        ("Tax Rate", f"{tax_rate:.2f}%"),
        ("Tax", f"{payment.currency} {tax_amount:.2f}"),
    ]
    sy = summary_top - 20
    pdf.setFillColor(text_dark)
    pdf.setFont("Helvetica", 9)
    for label, value in summary_rows:
        pdf.drawString(summary_x + 14, sy, label)
        pdf.drawRightString(summary_x + summary_w - 14, sy, value)
        sy -= 16
        pdf.setStrokeColor(line)
        pdf.line(summary_x + 12, sy + 6, summary_x + summary_w - 12, sy + 6)

    pdf.setFillColor(colors.HexColor("#dbeafe"))
    pdf.rect(summary_x + 1, summary_top - 104, summary_w - 2, 26, stroke=0, fill=1)
    pdf.setFillColor(text_dark)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(summary_x + 14, summary_top - 95, "Total")
    pdf.drawRightString(summary_x + summary_w - 14, summary_top - 95, f"{payment.currency} {total:.2f}")

    # Payout info under summary
    pdf.setFillColor(text_muted)
    pdf.setFont("Helvetica", 8.5)
    pdf.drawString(margin, summary_top - 104, f"Tutor Earnings: {payment.currency} {payment.tutor_earnings:.2f}")
    pdf.drawString(margin, summary_top - 118, f"Platform Fee: {payment.currency} {payment.total_platform_fee:.2f}")

    # Footer bar
    pdf.setFillColor(blue_dark)
    pdf.rect(0, 0, width, 34, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawCentredString(width / 2, 12, "Thank you for your business!")
    pdf.setFillColor(text_muted)
    pdf.setFont("Helvetica", 8.5)
    pdf.drawString(margin, 40, "This is a system-generated invoice from Zeal Catalyst.")
    pdf.drawRightString(width - margin, 40, "support@zealcatalyst.com")

    pdf.showPage()
    pdf.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()

    headers = {"Content-Disposition": f'attachment; filename="tutor-invoice-{payment_id}.pdf"'}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@router.get("/config")
async def get_razorpay_config():
    """Get Razorpay public configuration"""
    platform_settings = await PlatformSettings.get_or_create()
    return {
        "key_id": settings.RAZORPAY_KEY_ID,
        "currency": "INR",
        "name": "Zeal Catalyst",
        "description": "Tutoring Platform",
        "student_platform_fee_rate": platform_settings.student_platform_fee_rate
    }
