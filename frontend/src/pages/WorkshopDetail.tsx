import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Calendar, Clock3, Loader2, Users, User } from 'lucide-react';
import { bookingsAPI, paymentsAPI, workshopsAPI } from '../services/api';
import type { WorkshopResponse } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { DEMO_WORKSHOP, DEMO_WORKSHOP_ID } from '../utils/demoWorkshop';

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: {
    name: string;
    email: string;
    contact?: string;
  };
  theme: { color: string };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    backdropclose?: boolean;
  };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

const WorkshopDetail: React.FC = () => {
  const { workshopId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatPrice, currency } = useCurrency();

  const [workshop, setWorkshop] = useState<WorkshopResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    const fetchWorkshop = async () => {
      if (!workshopId) {
        setError('Workshop not found.');
        setLoading(false);
        return;
      }

      if (workshopId === DEMO_WORKSHOP_ID) {
        setWorkshop(DEMO_WORKSHOP);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const data = await workshopsAPI.getPublicWorkshopById(workshopId);
        setWorkshop(data);
      } catch {
        setError('Workshop not found.');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkshop();
  }, [workshopId]);

  const handleBookWorkshop = async () => {
    if (!workshop) return;
    setActionMessage(null);

    if (!user) {
      navigate('/login', {
        state: {
          from: `/workshops/${workshop.id}`,
          message: 'Please login to book this workshop',
        },
      });
      return;
    }

    if (!workshop.tutor_id) {
      setActionMessage({ type: 'error', text: 'This workshop is a demo listing and cannot be booked.' });
      return;
    }

    if (user.role === 'tutor' && user.id === workshop.tutor_user_id) {
      setActionMessage({ type: 'error', text: 'Tutors cannot book their own workshop.' });
      return;
    }

    setBookingInProgress(true);

    try {
      const cleanupUnpaidBooking = async (bookingId: string) => {
        try {
          await bookingsAPI.cancelBooking(bookingId);
        } catch {
          // ignore cleanup failure
        }
      };

      const bookingResponse = await bookingsAPI.create({
        tutor_id: workshop.tutor_id,
        subject: workshop.title,
        session_type: 'group',
        scheduled_at: workshop.scheduled_at,
        duration_minutes: workshop.duration_minutes,
        notes: `Workshop booking: ${workshop.id}`,
        currency,
      });

      const orderResponse = await paymentsAPI.createOrder(bookingResponse.id);
      if (
        !orderResponse.success ||
        !orderResponse.order_id ||
        !orderResponse.key_id ||
        !orderResponse.amount ||
        !orderResponse.currency
      ) {
        await cleanupUnpaidBooking(bookingResponse.id);
        throw new Error(orderResponse.error || 'Failed to create payment order');
      }

      const RazorpayCtor = (window as unknown as {
        Razorpay?: new (options: RazorpayOptions) => { open: () => void };
      }).Razorpay;

      if (typeof window === 'undefined' || !RazorpayCtor) {
        await cleanupUnpaidBooking(bookingResponse.id);
        throw new Error('Payment gateway is not loaded. Please refresh and try again.');
      }

      const options: RazorpayOptions = {
        key: orderResponse.key_id,
        amount: orderResponse.amount,
        currency: orderResponse.currency,
        name: 'Zeal Catalyst',
        description: workshop.title,
        order_id: orderResponse.order_id,
        handler: async (response: RazorpayResponse) => {
          try {
            const verifyResponse = await paymentsAPI.verifyPayment({
              booking_id: bookingResponse.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (!verifyResponse.success) {
              await cleanupUnpaidBooking(bookingResponse.id);
              setActionMessage({ type: 'error', text: 'Payment verification failed. Please contact support.' });
              setBookingInProgress(false);
              return;
            }

            setActionMessage({ type: 'success', text: 'Payment successful. Invoice is being sent to your email.' });
            const params = new URLSearchParams({
              booking_id: bookingResponse.id,
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
            });
            navigate(`/payment/thank-you?${params.toString()}`);
          } catch {
            await cleanupUnpaidBooking(bookingResponse.id);
            setActionMessage({ type: 'error', text: 'Payment verification failed. Please contact support.' });
            setBookingInProgress(false);
          }
        },
        prefill: {
          name: user.full_name || '',
          email: user.email || '',
          contact: user.phone || '',
        },
        theme: { color: '#2563eb' },
        modal: {
          ondismiss: async () => {
            await cleanupUnpaidBooking(bookingResponse.id);
            setBookingInProgress(false);
            setActionMessage({ type: 'error', text: 'Payment cancelled. Booking was not completed.' });
          },
          escape: true,
          backdropclose: false,
        },
      };

      const razorpay = new RazorpayCtor(options);
      razorpay.open();
    } catch (e: unknown) {
      const apiError = e as {
        response?: { data?: { detail?: string; error?: string; message?: string } };
        message?: string;
      };
      const msg =
        apiError?.response?.data?.detail ||
        apiError?.response?.data?.error ||
        apiError?.response?.data?.message ||
        apiError?.message ||
        'Unable to start payment. Please try again.';
      setActionMessage({ type: 'error', text: msg });
      setBookingInProgress(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen pt-24 px-4">Loading workshop...</div>;
  }

  if (error || !workshop) {
    return (
      <div className="min-h-screen pt-24 px-4">
        <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-xl p-8">
          <p className="text-red-600">{error || 'Workshop not found.'}</p>
          <Link to="/workshops" className="inline-block mt-4 text-primary-600 hover:text-primary-700">
            Back to Workshops
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/workshops" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
          {'<-'} Back to Workshops
        </Link>

        <div className="mt-4 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="aspect-[16/8] bg-gray-100">
            {workshop.thumbnail_url ? (
              <img src={workshop.thumbnail_url} alt={workshop.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">No image</div>
            )}
          </div>

          <div className="p-6 md:p-8">
            <h1 className="text-3xl font-bold text-gray-900">{workshop.title}</h1>

            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
              <div className="inline-flex items-center gap-2">
                <User className="w-4 h-4" />
                {workshop.tutor_name || 'Tutor'}
              </div>
              <div className="inline-flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(workshop.scheduled_at).toLocaleString()}
              </div>
              <div className="inline-flex items-center gap-2">
                <Clock3 className="w-4 h-4" />
                {workshop.duration_minutes} mins
              </div>
              <div className="inline-flex items-center gap-2">
                <Users className="w-4 h-4" />
                {workshop.max_participants} seats
              </div>
            </div>

            <div className="mt-6">
              <div className="text-sm text-gray-500">Fee</div>
              <div className="text-2xl font-bold text-primary-700">
                {formatPrice(workshop.amount)}
              </div>
            </div>

            {workshop.description && (
              <section className="mt-8">
                <h2 className="text-xl font-semibold text-gray-900">Course Details</h2>
                <p className="text-gray-700 mt-3 whitespace-pre-wrap">{workshop.description}</p>
              </section>
            )}

            <section className="mt-8">
              <h2 className="text-xl font-semibold text-gray-900">Modules</h2>
              {workshop.modules?.length ? (
                <ul className="mt-3 space-y-2">
                  {workshop.modules.map((module, index) => (
                    <li key={`${module}-${index}`} className="text-gray-700 bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                      {module}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-gray-600">Modules will be shared by tutor.</p>
              )}
            </section>

            <div className="mt-10 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleBookWorkshop}
                disabled={bookingInProgress}
                className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {bookingInProgress ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Book Workshop'
                )}
              </button>
              <Link
                to="/workshops"
                className="inline-flex items-center justify-center px-5 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
              >
                View More Workshops
              </Link>
            </div>

            {actionMessage && (
              <div
                className={`mt-4 rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${
                  actionMessage.type === 'error'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}
              >
                {actionMessage.type === 'error' && <AlertCircle className="w-4 h-4 mt-0.5" />}
                <span>{actionMessage.text}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkshopDetail;
