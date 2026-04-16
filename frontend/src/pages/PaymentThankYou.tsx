import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Calendar, Clock, User, CreditCard } from 'lucide-react';
import { bookingsAPI, paymentsAPI, type BookingResponse, type PaymentDetails } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { formatDateInIndia, formatTimeInIndia } from '../utils/datetime';

const PaymentThankYou = () => {
  const [searchParams] = useSearchParams();
  const { formatPrice } = useCurrency();
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const bookingId = searchParams.get('booking_id');
  const orderId = searchParams.get('order_id');
  const paymentId = searchParams.get('payment_id');

  useEffect(() => {
    const loadDetails = async () => {
      if (!bookingId) {
        setLoading(false);
        return;
      }

      try {
        const [bookingResult, paymentResult] = await Promise.allSettled([
          bookingsAPI.getById(bookingId),
          paymentsAPI.getPaymentDetails(bookingId),
        ]);

        if (bookingResult.status === 'fulfilled') {
          setBooking(bookingResult.value);
        }
        if (paymentResult.status === 'fulfilled') {
          setPayment(paymentResult.value);
        }
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [bookingId]);

  const scheduledDisplay = useMemo(() => {
    if (!booking?.scheduled_at) return null;
    return {
      date: formatDateInIndia(booking.scheduled_at, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      time: formatTimeInIndia(booking.scheduled_at, {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  }, [booking?.scheduled_at]);

  const totalAmount = payment?.session_amount ?? booking?.price ?? null;

  return (
    <div className="min-h-[70vh] bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-600 mt-0.5" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Payment Successful</h1>
              <p className="text-gray-600 mt-1">
                Your session has been booked successfully.
              </p>
            </div>
          </div>

          <div className="mt-6 border border-gray-100 rounded-xl divide-y divide-gray-100">
            {loading && (
              <div className="p-4 text-sm text-gray-500">Loading booking details...</div>
            )}

            {!loading && (
              <>
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <CreditCard className="w-4 h-4" />
                    <span>Total Paid</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {totalAmount !== null ? formatPrice(totalAmount) : 'Paid'}
                  </span>
                </div>

                {booking?.tutor_name && (
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <User className="w-4 h-4" />
                      <span>Tutor</span>
                    </div>
                    <span className="font-medium text-gray-900">{booking.tutor_name}</span>
                  </div>
                )}

                {booking?.subject && (
                  <div className="p-4 flex items-center justify-between gap-4">
                    <span className="text-gray-600">Subject</span>
                    <span className="font-medium text-gray-900">{booking.subject}</span>
                  </div>
                )}

                {scheduledDisplay?.date && (
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>Date</span>
                    </div>
                    <span className="font-medium text-gray-900">{scheduledDisplay.date}</span>
                  </div>
                )}

                {scheduledDisplay?.time && (
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>Time</span>
                    </div>
                    <span className="font-medium text-gray-900">{scheduledDisplay.time}</span>
                  </div>
                )}

                {(bookingId || orderId || paymentId) && (
                  <div className="p-4 text-xs text-gray-500 space-y-1">
                    {bookingId && <p>Booking ID: {bookingId}</p>}
                    {orderId && <p>Order ID: {orderId}</p>}
                    {paymentId && <p>Payment ID: {paymentId}</p>}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              to="/student/dashboard?tab=sessions"
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 transition-colors"
            >
              Go to My Sessions
            </Link>
            <Link
              to="/find-tutors"
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Book Another Session
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentThankYou;
