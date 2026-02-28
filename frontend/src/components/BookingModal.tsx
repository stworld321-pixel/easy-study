import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, ChevronRight, Clock, Calendar,
  Video, Users, Check, AlertCircle, CreditCard
} from 'lucide-react';
import { availabilityAPI, bookingsAPI, paymentsAPI } from '../services/api';
import type { TutorProfile } from '../types';
import type { CalendarDay } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useNavigate } from 'react-router-dom';

// Razorpay types
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  image?: string;
  handler: (response: RazorpayResponse) => void;
  prefill: {
    name: string;
    email: string;
    contact?: string;
  };
  notes?: {
    [key: string]: string;
  };
  theme: {
    color: string;
  };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    backdropclose?: boolean;
  };
  method?: {
    upi?: boolean;
    card?: boolean;
    netbanking?: boolean;
    wallet?: boolean;
    paylater?: boolean;
    emi?: boolean;
  };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
}

interface BookingModalProps {
  tutor: TutorProfile;
  onClose: () => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const BookingModal: React.FC<BookingModalProps> = ({ tutor, onClose }) => {
  const { user } = useAuth();
  const { formatPrice, currency } = useCurrency();
  const navigate = useNavigate();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([]);
  const [calendarSessionDuration, setCalendarSessionDuration] = useState<number>(60);
  const [studentPlatformFeeRate, setStudentPlatformFeeRate] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [sessionType, setSessionType] = useState<'private' | 'group'>('private');
  const [step, setStep] = useState<'date' | 'time' | 'confirm'>('date');
  const [booking, setBooking] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Get the base session price by session type and selected duration
  const getSessionPrice = (type: 'private' | 'group'): number => {
    const durationHours = (calendarSessionDuration || 60) / 60;
    if (type === 'group') {
      const groupHourly = tutor.group_hourly_rate || (tutor.hourly_rate * 0.6);
      return Math.round(groupHourly * durationHours * 100) / 100;
    }
    return Math.round(tutor.hourly_rate * durationHours * 100) / 100;
  };

  const getPlatformFee = (baseAmount: number): number => {
    return Math.round(baseAmount * studentPlatformFeeRate * 100) / 100;
  };

  const getStudentPayable = (baseAmount: number): number => {
    return Math.round((baseAmount + getPlatformFee(baseAmount)) * 100) / 100;
  };

  useEffect(() => {
    fetchCalendar();
  }, [currentMonth, tutor.id, sessionType]);

  useEffect(() => {
    const fetchPaymentConfig = async () => {
      try {
        const config = await paymentsAPI.getConfig();
        setStudentPlatformFeeRate(config.student_platform_fee_rate ?? 0);
      } catch {
        setStudentPlatformFeeRate(0);
      }
    };
    fetchPaymentConfig();
  }, []);

  const fetchCalendar = async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const data = await availabilityAPI.getPublicCalendar(tutor.id, year, month, sessionType);
      setCalendarData(data.days);
      setCalendarSessionDuration(data.session_duration || 60);
    } catch (error) {
      console.error('Failed to fetch calendar:', error);
      // Generate mock data
      generateMockCalendar();
    } finally {
      setLoading(false);
    }
  };

  const generateMockCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date().toISOString().split('T')[0];

    const days: CalendarDay[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isPast = dateStr < today;

      days.push({
        date: dateStr,
        is_available: !isPast,
        is_blocked: false,
        slots_count: isPast ? 0 : Math.floor(Math.random() * 8) + 1
      });
    }
    setCalendarData(days);
  };

  const getCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

    const grid: (CalendarDay | null)[] = [];

    for (let i = 0; i < adjustedFirstDay; i++) {
      grid.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const calDay = calendarData.find(d => d.date === dateStr);
      grid.push(calDay || { date: dateStr, is_available: false, is_blocked: false, slots_count: 0 });
    }

    return grid;
  };

  const getDayStyle = (day: CalendarDay) => {
    const today = new Date().toISOString().split('T')[0];
    const isPast = day.date < today;

    if (isPast) {
      return 'bg-gray-100 text-gray-300 cursor-not-allowed';
    }
    if (day.is_blocked) {
      return 'bg-rose-50 text-rose-400 cursor-not-allowed';
    }
    if (day.is_available && day.slots_count > 0) {
      return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer';
    }
    return 'bg-gray-100 text-gray-400 cursor-not-allowed';
  };

  const handleDateSelect = (day: CalendarDay) => {
    const today = new Date().toISOString().split('T')[0];
    if (day.date < today || day.is_blocked || !day.is_available) {
      return;
    }
    setSelectedDate(day.date);
    setSelectedTime(null);
    setStep('time');
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep('confirm');
  };

  const handleBooking = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!selectedDate || !selectedTime) {
      setMessage({ type: 'error', text: 'Please select a date and time.' });
      return;
    }

    setBooking(true);
    try {
      const cleanupUnpaidBooking = async (bookingId: string) => {
        try {
          await bookingsAPI.cancelBooking(bookingId);
        } catch {
          // Ignore cleanup errors; booking may already be cancelled/processed.
        }
      };

      // Step 1: Create booking with selected currency
      const bookingResponse = await bookingsAPI.create({
        tutor_id: tutor.id,
        scheduled_at: `${selectedDate}T${selectedTime}:00`,
        session_type: sessionType,
        duration_minutes: calendarSessionDuration || 60,
        subject: tutor.subjects[0] || 'General',
        currency: currency
      });

      // Step 2: Create Razorpay order
      const orderResponse = await paymentsAPI.createOrder(bookingResponse.id);

      if (!orderResponse.success || !orderResponse.order_id) {
        await cleanupUnpaidBooking(bookingResponse.id);
        throw new Error(orderResponse.error || 'Failed to create payment order');
      }

      if (typeof window === 'undefined' || !window.Razorpay) {
        await cleanupUnpaidBooking(bookingResponse.id);
        throw new Error('Payment gateway is not loaded. Please refresh and try again.');
      }

      // Step 3: Open Razorpay checkout
      const options: RazorpayOptions = {
        key: orderResponse.key_id!,
        amount: orderResponse.amount!,
        currency: orderResponse.currency!,
        name: 'Zeal Catalyst',
        description: `Session with ${tutor.full_name}`,
        order_id: orderResponse.order_id,
        handler: async (response: RazorpayResponse) => {
          // Step 4: Verify payment
          try {
            const verifyResponse = await paymentsAPI.verifyPayment({
              booking_id: bookingResponse.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyResponse.success) {
              setMessage({ type: 'success', text: 'Payment successful! Your session has been booked. Redirecting...' });
              setTimeout(() => {
                onClose();
                navigate('/student/dashboard');
              }, 2000);
            } else {
              await cleanupUnpaidBooking(bookingResponse.id);
              setMessage({ type: 'error', text: 'Payment verification failed. Please contact support.' });
            }
          } catch (verifyError) {
            console.error('Verification error:', verifyError);
            await cleanupUnpaidBooking(bookingResponse.id);
            setMessage({ type: 'error', text: 'Payment verification failed. Please contact support.' });
          }
          setBooking(false);
        },
        prefill: {
          name: user.full_name || '',
          email: user.email || '',
          contact: user.phone || '',
        },
        theme: {
          color: '#6366f1',
        },
        modal: {
          ondismiss: async () => {
            await cleanupUnpaidBooking(bookingResponse.id);
            setBooking(false);
            setMessage({ type: 'error', text: 'Payment cancelled. Slot released successfully.' });
          },
          escape: true,
          backdropclose: false,
        },
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          paylater: true,
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error: unknown) {
      console.error('Booking error:', error);
      const axiosError = error as {
        response?: { data?: { detail?: string; error?: string; message?: string } };
        message?: string;
      };
      const errorMessage =
        axiosError?.response?.data?.detail ||
        axiosError?.response?.data?.error ||
        axiosError?.response?.data?.message ||
        axiosError?.message ||
        'Failed to book session. Please try again.';
      setMessage({ type: 'error', text: errorMessage });
      setBooking(false);
    }
  };

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const getAvailableTimesForDate = (dateStr: string): string[] => {
    const day = calendarData.find(d => d.date === dateStr);
    if (!day?.time_slots?.length) {
      return [];
    }

    const parseTimeToMinutes = (time: string): number => {
      const [h, m] = time.split(':').map(Number);
      return (h * 60) + m;
    };
    const toTimeString = (minutes: number): string => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const uniqueTimes = new Set<string>();
    const slotDuration = Math.max(15, calendarSessionDuration || 60);

    day.time_slots.forEach((slot) => {
      if (!slot.start_time || !slot.end_time) return;
      const start = parseTimeToMinutes(slot.start_time);
      const end = parseTimeToMinutes(slot.end_time);
      for (let t = start; t + slotDuration <= end; t += slotDuration) {
        uniqueTimes.add(toTimeString(t));
      }
    });

    return Array.from(uniqueTimes).sort((a, b) => a.localeCompare(b));
  };

  const availableTimesForSelectedDate = selectedDate ? getAvailableTimesForDate(selectedDate) : [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={tutor.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${tutor.full_name}`}
                  alt={tutor.full_name}
                  className="w-12 h-12 rounded-xl object-cover ring-2 ring-white/30"
                />
                <div>
                  <h2 className="text-lg font-bold text-white">Book a Session</h2>
                  <p className="text-primary-100 text-sm">with {tutor.full_name}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Steps Indicator */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-center gap-4">
              {[
                { id: 'date', label: 'Select Date', icon: Calendar },
                { id: 'time', label: 'Select Time', icon: Clock },
                { id: 'confirm', label: 'Confirm', icon: Check },
              ].map((s, idx) => (
                <React.Fragment key={s.id}>
                  <div className={`flex items-center gap-2 ${
                    step === s.id ? 'text-primary-600' :
                    ['date', 'time', 'confirm'].indexOf(step) > idx ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      step === s.id ? 'bg-primary-100' :
                      ['date', 'time', 'confirm'].indexOf(step) > idx ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <s.icon className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium hidden sm:block">{s.label}</span>
                  </div>
                  {idx < 2 && (
                    <div className={`w-12 h-0.5 ${
                      ['date', 'time', 'confirm'].indexOf(step) > idx ? 'bg-green-300' : 'bg-gray-200'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {/* Message */}
            <AnimatePresence>
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`mb-4 p-4 rounded-xl flex items-center gap-3 ${
                    message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  {message.text}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Date Selection */}
            {step === 'date' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                {/* Session Type */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Session Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {tutor.offers_private && (
                      <button
                        onClick={() => {
                          setSessionType('private');
                          setSelectedDate(null);
                          setSelectedTime(null);
                          setStep('date');
                        }}
                        className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                          sessionType === 'private'
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Video className={`w-5 h-5 ${sessionType === 'private' ? 'text-primary-600' : 'text-gray-400'}`} />
                        <div className="text-left">
                          <div className={`font-medium ${sessionType === 'private' ? 'text-primary-900' : 'text-gray-900'}`}>
                            1-on-1
                          </div>
                          <div className="text-xs text-gray-500">{formatPrice(getSessionPrice('private'))}/hr</div>
                        </div>
                      </button>
                    )}
                    {tutor.offers_group && (
                      <button
                        onClick={() => {
                          setSessionType('group');
                          setSelectedDate(null);
                          setSelectedTime(null);
                          setStep('date');
                        }}
                        className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                          sessionType === 'group'
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Users className={`w-5 h-5 ${sessionType === 'group' ? 'text-primary-600' : 'text-gray-400'}`} />
                        <div className="text-left">
                          <div className={`font-medium ${sessionType === 'group' ? 'text-primary-900' : 'text-gray-900'}`}>
                            Group
                          </div>
                          <div className="text-xs text-gray-500">{formatPrice(getSessionPrice('group'))}/hr</div>
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                {/* Calendar */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={prevMonth}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                      </button>
                      <button
                        onClick={nextMonth}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>
                  </div>

                  {loading ? (
                    <div className="h-64 flex items-center justify-center">
                      <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-7 gap-1">
                      {/* Day Headers */}
                      {DAY_LABELS.map((day, idx) => (
                        <div
                          key={day}
                          className={`p-2 text-center text-xs font-semibold ${
                            idx >= 5 ? 'text-rose-500' : 'text-gray-500'
                          }`}
                        >
                          {day}
                        </div>
                      ))}

                      {/* Calendar Days */}
                      {getCalendarGrid().map((day, index) => (
                        <div key={index} className="aspect-square p-0.5">
                          {day && (
                            <button
                              onClick={() => handleDateSelect(day)}
                              disabled={day.date < new Date().toISOString().split('T')[0] || day.is_blocked || !day.is_available}
                              className={`w-full h-full rounded-lg flex flex-col items-center justify-center transition-all text-sm ${getDayStyle(day)} ${
                                selectedDate === day.date ? 'ring-2 ring-primary-500' : ''
                              }`}
                            >
                              <span className="font-semibold">{parseInt(day.date.split('-')[2])}</span>
                              {day.is_available && day.slots_count > 0 && (
                                <span className="text-[9px]">{day.slots_count} slots</span>
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Legend */}
                  <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" />
                      <span className="text-gray-600">Available</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded bg-rose-50 border border-rose-200" />
                      <span className="text-gray-600">Blocked/Unavailable</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
                      <span className="text-gray-600">Past/No slots</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Time Selection */}
            {step === 'time' && selectedDate && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <button
                  onClick={() => setStep('date')}
                  className="flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-4"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to calendar
                </button>

                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900">{formatDate(selectedDate)}</h3>
                  <p className="text-sm text-gray-500">Select a time slot</p>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {availableTimesForSelectedDate.map((time) => (
                    <button
                      key={time}
                      onClick={() => handleTimeSelect(time)}
                      className={`py-3 px-2 rounded-xl text-sm font-medium transition-all ${
                        selectedTime === time
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
                {availableTimesForSelectedDate.length === 0 && (
                  <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
                    No bookable times available for this date.
                  </div>
                )}
              </motion.div>
            )}

            {/* Confirmation */}
            {step === 'confirm' && selectedDate && selectedTime && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <button
                  onClick={() => setStep('time')}
                  className="flex items-center gap-2 text-primary-600 hover:text-primary-700 mb-4"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to time selection
                </button>

                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Booking Summary</h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Tutor</span>
                      <span className="font-medium text-gray-900">{tutor.full_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Date</span>
                      <span className="font-medium text-gray-900">{formatDate(selectedDate)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Time</span>
                      <span className="font-medium text-gray-900">{selectedTime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Session Type</span>
                      <span className="font-medium text-gray-900 capitalize">{sessionType}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Duration</span>
                      <span className="font-medium text-gray-900">{calendarSessionDuration || 60} minutes</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                      <span className="text-gray-600">Session Price</span>
                      <span className="font-medium text-gray-900">
                        {formatPrice(getSessionPrice(sessionType))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">
                        Platform Fee ({(studentPlatformFeeRate * 100).toFixed(2)}%)
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatPrice(getPlatformFee(getSessionPrice(sessionType)))}
                      </span>
                    </div>
                    <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
                      <span className="text-gray-900 font-semibold">Total</span>
                      <span className="text-2xl font-bold text-primary-600">
                        {formatPrice(getStudentPayable(getSessionPrice(sessionType)))}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleBooking}
                  disabled={booking}
                  className="w-full mt-6 py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all duration-300 shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {booking ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Pay & Confirm Booking
                    </>
                  )}
                </button>

                {!user && (
                  <p className="text-center text-sm text-gray-500 mt-4">
                    You'll need to sign in to complete the booking
                  </p>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BookingModal;
