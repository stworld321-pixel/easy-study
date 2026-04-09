import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Calendar, Clock, DollarSign, BookOpen,
  MapPin, GraduationCap, Save, ChevronLeft, ChevronRight,
  Plus, X, Check, AlertCircle, Users, Video,
  Briefcase, Languages, Award, Link, Copy, ExternalLink,
  Wallet, TrendingUp, ArrowDownCircle, CreditCard, Building, Smartphone,
  FileText, ClipboardList, MessageSquare, Upload, Download, Trash2, Star
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { tutorsAPI, availabilityAPI, bookingsAPI, withdrawalAPI, materialsAPI, uploadAPI, workshopsAPI, paymentsAPI } from '../services/api';
import ImageUpload from '../components/ImageUpload';
import ChatInbox from '../components/ChatInbox';
import type { TutorProfile } from '../types';
import type { AvailabilitySettings, WeeklySchedule, TimeSlot, CalendarDay, BlockedDate, BookingResponse, TutorStats, WithdrawalResponse, MaterialResponse, AssignmentResponse, RatingResponse, BookedStudent, WorkshopResponse, WorkshopCreateInput, TutorPaymentListItem } from '../services/api';

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SUBJECTS_LIST = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English',
  'Computer Science', 'Data Science', 'Web Development', 'Python',
  'JavaScript', 'Machine Learning', 'Spanish', 'French', 'German',
  'IELTS', 'TOEFL', 'SAT Prep', 'UI/UX Design', 'Music', 'Art',
  'History', 'Geography', 'Economics', 'Accounting', 'Business Studies',
  'Psychology', 'Sociology', 'Political Science', 'Philosophy', 'Literature'
];

const LANGUAGES_LIST = ['English', 'Spanish', 'French', 'German', 'Mandarin', 'Hindi', 'Arabic', 'Portuguese', 'Japanese', 'Korean'];

// Types are now imported from api.ts

const TutorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'profile' | 'availability' | 'calendar' | 'bookings' | 'workshops' | 'earnings' | 'materials' | 'assignments' | 'feedback' | 'messages'>('profile');

  // Handle tab query parameter from notifications
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['profile', 'availability', 'calendar', 'bookings', 'workshops', 'earnings', 'materials', 'assignments', 'feedback', 'messages'].includes(tabParam)) {
      setActiveTab(tabParam as typeof activeTab);
    }

  }, [searchParams]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile state
  const [profile, setProfile] = useState<Partial<TutorProfile>>({
    headline: '',
    bio: '',
    experience_years: 0,
    education: '',
    hourly_rate: 0,
    group_hourly_rate: 0,
    languages: ['English'],
    subjects: [],
    country: '',
    city: '',
    offers_private: true,
    offers_group: false,
  });

  // Availability state
  const [, setAvailability] = useState<AvailabilitySettings | null>(null);
  const [privateWeeklySchedule, setPrivateWeeklySchedule] = useState<WeeklySchedule>({
    monday: [], tuesday: [], wednesday: [], thursday: [],
    friday: [], saturday: [], sunday: []
  });
  const [sessionDuration, setSessionDuration] = useState<number>(60);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [jitsiTestLoading, setJitsiTestLoading] = useState(false);

  // Bookings state
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [bookingView, setBookingView] = useState<'upcoming' | 'private' | 'finished' | 'cancelled'>('upcoming');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingMeetLink, setEditingMeetLink] = useState<string | null>(null);
  const [meetLinkInput, setMeetLinkInput] = useState('');

  // Custom subject input state
  const [customSubjectInput, setCustomSubjectInput] = useState('');

  // Earnings & Withdrawal state
  const [tutorStats, setTutorStats] = useState<TutorStats | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalResponse[]>([]);
  const [tutorPayments, setTutorPayments] = useState<TutorPaymentListItem[]>([]);
  const [paymentFilterFrom, setPaymentFilterFrom] = useState('');
  const [paymentFilterTo, setPaymentFilterTo] = useState('');
  const [paymentFilterStatus, setPaymentFilterStatus] = useState<'all' | 'completed' | 'pending' | 'failed' | 'refunded'>('all');
  const [paymentFilterStudent, setPaymentFilterStudent] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'upi' | 'paypal'>('bank_transfer');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);

  // Materials state
  const [materials, setMaterials] = useState<MaterialResponse[]>([]);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [materialForm, setMaterialForm] = useState({ title: '', description: '', subject: '' });
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [certificatePreviewForm, setCertificatePreviewForm] = useState({
    student_name: 'STUDENT NAME',
    subject: 'GENERAL SESSION',
    session_name: '',
    session_date: new Date().toISOString().slice(0, 10),
  });
  const [bookedStudents, setBookedStudents] = useState<BookedStudent[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [shareWithAll, setShareWithAll] = useState(true);

  // Assignments state
  const [assignments, setAssignments] = useState<AssignmentResponse[]>([]);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({ title: '', description: '', subject: '', due_date: '', max_marks: 100 });
  const [assignmentShareWithAll, setAssignmentShareWithAll] = useState(true);
  const [assignmentSelectedStudents, setAssignmentSelectedStudents] = useState<string[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  // Feedback state
  const [feedbacks, setFeedbacks] = useState<RatingResponse[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopResponse[]>([]);
  const [showWorkshopForm, setShowWorkshopForm] = useState(false);
  const [editingWorkshopId, setEditingWorkshopId] = useState<string | null>(null);
  const [workshopSaving, setWorkshopSaving] = useState(false);
  const [workshopModuleInput, setWorkshopModuleInput] = useState('');
  const [workshopForm, setWorkshopForm] = useState<WorkshopCreateInput>({
    title: '',
    description: '',
    modules: [],
    thumbnail_url: '',
    amount: 0,
    currency: 'INR',
    scheduled_at: '',
    duration_minutes: 60,
    max_participants: 50,
    is_active: true,
  });

  const getMeetingOriginLabel = (origin?: string) => {
    switch (origin) {
      case 'lms_embedded':
        return 'Platform meeting (embedded)';
      case 'shared_group_event':
        return 'Shared group event';
      case 'tutor_manual':
        return 'Manual link';
      default:
        return 'Not specified';
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'calendar') {
      fetchCalendar();
    }
    if (activeTab === 'earnings') {
      fetchEarnings();
    }
    if (activeTab === 'materials') {
      fetchMaterials();
    }
    if (activeTab === 'assignments') {
      fetchAssignments();
    }
    if (activeTab === 'feedback') {
      fetchFeedbacks();
    }
    if (activeTab === 'workshops') {
      fetchWorkshops();
    }
  }, [currentMonth, activeTab]);

  const fetchWorkshops = async () => {
    try {
      const data = await workshopsAPI.getMyWorkshops();
      setWorkshops(data);
    } catch (error) {
      console.error('Failed to fetch workshops:', error);
    }
  };

  const handleStartJitsiTestMeeting = async () => {
    setJitsiTestLoading(true);
    try {
      const access = await bookingsAPI.getJitsiTestAccess();
      window.open(access.launch_url, '_blank', 'noopener,noreferrer');
      setMessage({ type: 'success', text: 'Jitsi test meeting opened in a new tab.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to open Jitsi test meeting.' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setJitsiTestLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const data = await materialsAPI.getMaterials();
      setMaterials(data);
    } catch (error) {
      console.error('Failed to fetch materials:', error);
    }
  };

  const fetchBookedStudents = async () => {
    try {
      const data = await materialsAPI.getBookedStudents();
      setBookedStudents(data);
    } catch (error) {
      console.error('Failed to fetch booked students:', error);
    }
  };

  const fetchAssignments = async () => {
    try {
      const data = await materialsAPI.getAssignments();
      setAssignments(data);
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
    }
  };

  const fetchFeedbacks = async () => {
    try {
      const data = await materialsAPI.getMyRatings();
      setFeedbacks(data);
    } catch (error) {
      console.error('Failed to fetch feedbacks:', error);
    }
  };

  const fetchEarnings = async () => {
    try {
      const [statsData, withdrawalsData, tutorPaymentsData] = await Promise.all([
        withdrawalAPI.getStats(),
        withdrawalAPI.getMyWithdrawals(),
        paymentsAPI.getTutorPayments().catch(() => []),
      ]);
      setTutorStats(statsData);
      setWithdrawals(withdrawalsData);
      setTutorPayments(tutorPaymentsData);
    } catch (error) {
      console.error('Failed to fetch earnings:', error);
    }
  };

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startOfWeek = (d: Date) => {
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1; // monday start
    const date = new Date(d);
    date.setDate(d.getDate() - diff);
    return startOfDay(date);
  };
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

  const earningsAnalysis = useMemo(() => {
    const now = new Date();
    const sod = startOfDay(now);
    const sow = startOfWeek(now);
    const som = startOfMonth(now);

    const completedPayments = tutorPayments.filter((p) => p.status === 'completed');
    const completedSessions = bookings.filter((b) => b.status === 'completed');

    const todayEarnings = completedPayments
      .filter((p) => new Date(p.created_at) >= sod)
      .reduce((sum, p) => sum + p.tutor_earnings, 0);
    const weeklyEarnings = completedPayments
      .filter((p) => new Date(p.created_at) >= sow)
      .reduce((sum, p) => sum + p.tutor_earnings, 0);
    const monthlyEarnings = completedPayments
      .filter((p) => new Date(p.created_at) >= som)
      .reduce((sum, p) => sum + p.tutor_earnings, 0);

    const todaySessions = completedSessions.filter((b) => new Date(b.scheduled_at) >= sod).length;
    const weeklySessions = completedSessions.filter((b) => new Date(b.scheduled_at) >= sow).length;
    const monthlySessions = completedSessions.filter((b) => new Date(b.scheduled_at) >= som).length;

    return {
      todayEarnings,
      weeklyEarnings,
      monthlyEarnings,
      todaySessions,
      weeklySessions,
      monthlySessions,
    };
  }, [tutorPayments, bookings]);

  const filteredTutorPayments = useMemo(() => {
    return tutorPayments.filter((p) => {
      const paymentDate = new Date(p.scheduled_at || p.created_at);
      if (paymentFilterFrom) {
        const from = new Date(`${paymentFilterFrom}T00:00:00`);
        if (paymentDate < from) return false;
      }
      if (paymentFilterTo) {
        const to = new Date(`${paymentFilterTo}T23:59:59`);
        if (paymentDate > to) return false;
      }
      if (paymentFilterStatus !== 'all' && p.status !== paymentFilterStatus) {
        return false;
      }
      if (paymentFilterStudent.trim()) {
        const q = paymentFilterStudent.trim().toLowerCase();
        if (!(p.student_name || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tutorPayments, paymentFilterFrom, paymentFilterTo, paymentFilterStatus, paymentFilterStudent]);

  const handleDownloadTutorInvoice = async (paymentId: string) => {
    try {
      const blob = await paymentsAPI.downloadTutorInvoice(paymentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tutor-invoice-${paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download invoice:', error);
      setMessage({ type: 'error', text: 'Failed to download invoice' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleWithdrawalRequest = async () => {
    const amount = parseFloat(withdrawalAmount);
    if (!amount || amount <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid amount' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    if (!paymentDetails.trim()) {
      setMessage({ type: 'error', text: 'Please enter payment details' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    if (tutorStats && amount > tutorStats.available_balance) {
      setMessage({ type: 'error', text: `Insufficient balance. Available: ${tutorStats.currency} ${tutorStats.available_balance.toFixed(2)}` });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setWithdrawalLoading(true);
    try {
      await withdrawalAPI.requestWithdrawal({
        amount,
        payment_method: paymentMethod,
        payment_details: paymentDetails.trim()
      });
      setMessage({ type: 'success', text: 'Withdrawal request submitted successfully!' });
      setTimeout(() => setMessage(null), 3000);
      setWithdrawalAmount('');
      setPaymentDetails('');
      fetchEarnings();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to submit withdrawal request' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setWithdrawalLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profileData, availabilityData, blockedData, bookingsData] = await Promise.all([
        tutorsAPI.getMyProfile().catch(() => null),
        availabilityAPI.getSettings().catch(() => null),
        availabilityAPI.getBlockedDates().catch(() => ({ blocked_dates: [] })),
        bookingsAPI.getTutorBookings().catch(() => [])
      ]);

      if (profileData) {
        setProfile(profileData);
      }

      if (availabilityData) {
        setAvailability(availabilityData);
        setPrivateWeeklySchedule(availabilityData.private_weekly_schedule || availabilityData.weekly_schedule);
        setSessionDuration(availabilityData.session_duration || 60);
      }

      setBlockedDates(blockedData.blocked_dates);
      setBookings(bookingsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get bookings for a specific date
  const getBookingsForDate = (dateStr: string): BookingResponse[] => {
    return bookings.filter(b => b.scheduled_at.split('T')[0] === dateStr);
  };

  // Check if a date has bookings
  const hasBookings = (dateStr: string): boolean => {
    return getBookingsForDate(dateStr).length > 0;
  };

  const fetchCalendar = async () => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth() + 1;
      const data = await availabilityAPI.getCalendar(year, month);
      setCalendarDays(data.days);
    } catch (error) {
      console.error('Failed to fetch calendar:', error);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await tutorsAPI.updateProfile({
        ...profile,
        offers_group: false,
        group_hourly_rate: 0,
      });
      setMessage({ type: 'success', text: 'Profile saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAvailability = async () => {
    setSaving(true);
    try {
      await availabilityAPI.updateSchedule(privateWeeklySchedule, 'private');
      await availabilityAPI.updateSettings({
        session_duration: Math.max(15, Number(sessionDuration) || 60),
      } as Partial<AvailabilitySettings>);
      setMessage({ type: 'success', text: 'Availability saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
      fetchCalendar();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to save availability' });
    } finally {
      setSaving(false);
    }
  };

  const addTimeSlot = (day: keyof WeeklySchedule) => {
    const newSlot: TimeSlot = { start_time: '09:00', end_time: '17:00' };
    setPrivateWeeklySchedule(prev => ({
      ...prev,
      [day]: [...prev[day], newSlot]
    }));
  };

  const removeTimeSlot = (day: keyof WeeklySchedule, index: number) => {
    setPrivateWeeklySchedule(prev => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== index)
    }));
  };

  const updateTimeSlot = (day: keyof WeeklySchedule, index: number, field: 'start_time' | 'end_time', value: string) => {
    setPrivateWeeklySchedule(prev => ({
      ...prev,
      [day]: prev[day].map((slot, i) => i === index ? { ...slot, [field]: value } : slot)
    }));
  };

  const handleBlockDate = async () => {
    if (!selectedDate) return;
    try {
      const newBlocked = await availabilityAPI.addBlockedDate(selectedDate, blockReason);
      setBlockedDates(prev => [...prev, newBlocked]);
      setSelectedDate(null);
      setBlockReason('');
      fetchCalendar();
      setMessage({ type: 'success', text: 'Date blocked successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to block date' });
    }
  };

  const handleUnblockDate = async (dateId: string) => {
    try {
      await availabilityAPI.removeBlockedDate(dateId);
      setBlockedDates(prev => prev.filter(d => d.id !== dateId));
      fetchCalendar();
      setMessage({ type: 'success', text: 'Date unblocked!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to unblock date' });
    }
  };

  // Booking actions
  const handleConfirmBooking = async (bookingId: string) => {
    setActionLoading(bookingId);
    try {
      const updated = await bookingsAPI.confirmBooking(bookingId);
      setBookings(prev => prev.map(b => b.id === bookingId ? updated : b));
      setMessage({ type: 'success', text: 'Booking confirmed! Session link has been generated.' });
      setTimeout(() => setMessage(null), 4000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to confirm booking' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    setActionLoading(bookingId);
    try {
      const updated = await bookingsAPI.cancelBooking(bookingId);
      setBookings(prev => prev.map(b => b.id === bookingId ? updated : b));
      setMessage({ type: 'success', text: 'Booking cancelled' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to cancel booking' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateMeetLink = async (bookingId: string) => {
    if (!meetLinkInput.trim()) return;
    setActionLoading(bookingId);
    try {
      const updated = await bookingsAPI.updateMeetLink(bookingId, meetLinkInput.trim());
      setBookings(prev => prev.map(b => b.id === bookingId ? updated : b));
      setEditingMeetLink(null);
      setMeetLinkInput('');
      setMessage({ type: 'success', text: 'Meet link updated!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update Meet link' });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePreviewCertificate = async () => {
    setPreviewLoading(true);
    try {
      const blob = await materialsAPI.getTutorCertificatePreview({
        student_name: certificatePreviewForm.student_name,
        subject: certificatePreviewForm.subject,
        session_name: certificatePreviewForm.session_name || undefined,
        session_date: certificatePreviewForm.session_date || undefined,
      });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to generate certificate preview' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setPreviewLoading(false);
    }
  };

  const resetWorkshopForm = () => {
    setWorkshopForm({
      title: '',
      description: '',
      modules: [],
      thumbnail_url: '',
      amount: 0,
      currency: (profile.currency || 'INR').toUpperCase(),
      scheduled_at: '',
      duration_minutes: 60,
      max_participants: 50,
      is_active: true,
    });
    setEditingWorkshopId(null);
    setWorkshopModuleInput('');
    setShowWorkshopForm(false);
  };

  const openCreateWorkshop = () => {
    resetWorkshopForm();
    setShowWorkshopForm(true);
  };

  const openEditWorkshop = (workshop: WorkshopResponse) => {
    setWorkshopForm({
      title: workshop.title,
      description: workshop.description || '',
      modules: workshop.modules || [],
      thumbnail_url: workshop.thumbnail_url || '',
      amount: workshop.amount,
      currency: workshop.currency || 'INR',
      scheduled_at: workshop.scheduled_at ? workshop.scheduled_at.slice(0, 16) : '',
      duration_minutes: workshop.duration_minutes,
      max_participants: workshop.max_participants,
      is_active: workshop.is_active,
    });
    setEditingWorkshopId(workshop.id);
    setWorkshopModuleInput('');
    setShowWorkshopForm(true);
  };

  const addWorkshopModule = () => {
    const value = workshopModuleInput.trim();
    if (!value) return;
    if (workshopForm.modules.includes(value)) {
      setWorkshopModuleInput('');
      return;
    }
    setWorkshopForm(prev => ({ ...prev, modules: [...prev.modules, value] }));
    setWorkshopModuleInput('');
  };

  const removeWorkshopModule = (module: string) => {
    setWorkshopForm(prev => ({ ...prev, modules: prev.modules.filter(m => m !== module) }));
  };

  const handleSaveWorkshop = async () => {
    if (!workshopForm.title.trim()) {
      setMessage({ type: 'error', text: 'Workshop title is required.' });
      setTimeout(() => setMessage(null), 2500);
      return;
    }
    if (!workshopForm.scheduled_at) {
      setMessage({ type: 'error', text: 'Workshop date and time are required.' });
      setTimeout(() => setMessage(null), 2500);
      return;
    }

    setWorkshopSaving(true);
    try {
      const payload: WorkshopCreateInput = {
        ...workshopForm,
        title: workshopForm.title.trim(),
        description: workshopForm.description?.trim() || '',
        currency: (workshopForm.currency || profile.currency || 'INR').toUpperCase(),
        scheduled_at: new Date(workshopForm.scheduled_at).toISOString(),
      };
      if (editingWorkshopId) {
        await workshopsAPI.updateWorkshop(editingWorkshopId, payload);
      } else {
        await workshopsAPI.createWorkshop(payload);
      }
      await fetchWorkshops();
      resetWorkshopForm();
      setMessage({ type: 'success', text: `Workshop ${editingWorkshopId ? 'updated' : 'created'} successfully.` });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: `Failed to ${editingWorkshopId ? 'update' : 'create'} workshop.` });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setWorkshopSaving(false);
    }
  };

  const handleDeleteWorkshop = async (id: string) => {
    if (!confirm('Delete this workshop?')) return;
    try {
      await workshopsAPI.deleteWorkshop(id);
      setWorkshops(prev => prev.filter(w => w.id !== id));
      setMessage({ type: 'success', text: 'Workshop deleted.' });
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete workshop.' });
      setTimeout(() => setMessage(null), 2500);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: 'Copied to clipboard!' });
    setTimeout(() => setMessage(null), 2000);
  };

  const toggleSubject = (subject: string) => {
    setProfile(prev => ({
      ...prev,
      subjects: prev.subjects?.includes(subject)
        ? prev.subjects.filter(s => s !== subject)
        : [...(prev.subjects || []), subject]
    }));
  };

  const addCustomSubject = () => {
    const trimmed = customSubjectInput.trim();
    if (trimmed && !profile.subjects?.includes(trimmed)) {
      setProfile(prev => ({
        ...prev,
        subjects: [...(prev.subjects || []), trimmed]
      }));
      setCustomSubjectInput('');
    }
  };

  const removeSubject = (subject: string) => {
    setProfile(prev => ({
      ...prev,
      subjects: prev.subjects?.filter(s => s !== subject) || []
    }));
  };

  const handleSubjectKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomSubject();
    }
  };

  const toggleLanguage = (lang: string) => {
    setProfile(prev => ({
      ...prev,
      languages: prev.languages?.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...(prev.languages || []), lang]
    }));
  };

  // Calendar navigation
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

  // Get calendar grid
  const getCalendarGrid = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Adjust for Monday start

    const grid: (CalendarDay | null)[] = [];

    // Empty cells before first day
    for (let i = 0; i < adjustedFirstDay; i++) {
      grid.push(null);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const calDay = calendarDays.find(d => d.date === dateStr);
      grid.push(calDay || { date: dateStr, is_available: false, is_blocked: false, slots_count: 0 });
    }

    return grid;
  };

  // Get day styling based on availability and booking status
  const getDayStyle = (day: CalendarDay) => {
    const today = new Date().toISOString().split('T')[0];
    const isPast = day.date < today;
    const dayHasBookings = hasBookings(day.date);

    if (day.is_blocked) {
      // Explicitly blocked - darker red
      return 'bg-red-200 text-red-800 border-2 border-red-300';
    }
    if (dayHasBookings) {
      // Has bookings - blue
      return 'bg-blue-100 text-blue-700 border-2 border-blue-300 hover:bg-blue-200 cursor-pointer';
    }
    if (day.is_available && day.slots_count > 0) {
      // Available with slots - green
      return `bg-emerald-100 text-emerald-700 border border-emerald-200 ${!isPast ? 'hover:bg-emerald-200 hover:border-emerald-300 cursor-pointer' : ''}`;
    }
    if (isPast) {
      return 'bg-gray-50 text-gray-300 border border-gray-100';
    }
    // No availability set
    return 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200 cursor-pointer';
  };

  const now = new Date();
  const sortedBookings = [...bookings].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );
  const bookingViews: Record<'upcoming' | 'private' | 'finished' | 'cancelled', BookingResponse[]> = {
    upcoming: sortedBookings.filter(
      b => new Date(b.scheduled_at) >= now && (b.status === 'pending' || b.status === 'confirmed')
    ),
    private: sortedBookings.filter(b => b.session_type === 'private' && b.status !== 'cancelled'),
    finished: sortedBookings.filter(b => b.status === 'completed' || (new Date(b.scheduled_at) < now && b.status === 'confirmed')),
    cancelled: sortedBookings.filter(b => b.status === 'cancelled'),
  };
  const currentBookings = bookingViews[bookingView];
  const bookingViewLabels: Record<'upcoming' | 'private' | 'finished' | 'cancelled', string> = {
    upcoming: 'Upcoming Sessions',
    private: 'Private Sessions',
    finished: 'Finished Sessions',
    cancelled: 'Cancelled Sessions',
  };
  const pendingBookingsCount = bookings.filter(b => b.status === 'pending').length;
  const dashboardTabs: Array<{ id: typeof activeTab; label: string; icon: React.ElementType }> = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'availability', label: 'Schedule', icon: Clock },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'bookings', label: 'Session Bookings', icon: Video },
    { id: 'workshops', label: 'Workshops', icon: Briefcase },
    { id: 'materials', label: 'Materials', icon: FileText },
    { id: 'assignments', label: 'Assignments', icon: ClipboardList },
    { id: 'feedback', label: 'Feedback', icon: MessageSquare },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'earnings', label: 'Earnings', icon: Wallet },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.full_name?.split(' ')[0]}!
          </h1>
          <p className="text-gray-600 mt-2">Manage your profile, availability, and schedule</p>
        </motion.div>

        {/* Message Toast */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-24 right-4 z-50 px-6 py-4 rounded-xl shadow-lg ${
                message.type === 'success' ? 'bg-green-500' : 'bg-red-500'
              } text-white flex items-center gap-2`}
            >
              {message.type === 'success' ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending Bookings Alert */}
        {pendingBookingsCount > 0 && activeTab !== 'bookings' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-full">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="font-medium text-yellow-800">
                  You have {pendingBookingsCount} pending booking request{pendingBookingsCount > 1 ? 's' : ''}
                </p>
                <p className="text-sm text-yellow-600">Review and confirm to avoid missing sessions</p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('bookings')}
              className="px-4 py-2 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 transition-colors font-medium"
            >
              View Requests
            </button>
          </motion.div>
        )}

        <div className="lg:grid lg:grid-cols-[260px,1fr] lg:gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
              <nav className="space-y-1">
                {dashboardTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center justify-between gap-2 py-3 px-3 rounded-xl font-medium transition-all duration-300 relative ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/20'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <tab.icon className="w-5 h-5" />
                      <span className="text-sm">{tab.label}</span>
                    </span>
                    {tab.id === 'bookings' && pendingBookingsCount > 0 && (
                      <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {pendingBookingsCount}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content Column */}
          <div>
            {/* Mobile Tabs */}
            <div className="flex gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto lg:hidden">
              {dashboardTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all duration-300 relative whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                  {tab.id === 'bookings' && pendingBookingsCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {pendingBookingsCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="grid lg:grid-cols-3 gap-8"
          >
            {/* Main Profile Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Profile Photo Card */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary-600" />
                  Profile Photo
                </h2>
                <div className="flex items-start gap-6">
                  <ImageUpload
                    currentImage={profile.avatar}
                    onUploadSuccess={(url) => {
                      setProfile(prev => ({ ...prev, avatar: url }));
                      setMessage({ type: 'success', text: 'Profile photo updated!' });
                      setTimeout(() => setMessage(null), 3000);
                    }}
                    type="tutor"
                  />
                  <div className="flex-1">
                    <p className="text-gray-600 text-sm mb-3">
                      Upload a professional photo to make a great first impression. Tutors with photos get 40% more bookings!
                    </p>
                    <ul className="text-xs text-gray-500 space-y-1">
                      <li>• Use a clear, well-lit photo of your face</li>
                      <li>• Smile and look approachable</li>
                      <li>• Avoid group photos or logos</li>
                      <li>• Minimum 200x200 pixels recommended</li>
                    </ul>

                    <div className="mt-5 border-t border-gray-100 pt-4">
                      <p className="text-sm font-semibold text-gray-900 mb-2">Signature for Certificates</p>
                      <p className="text-xs text-gray-500 mb-3">
                        Upload your handwritten signature image. Background will be removed automatically for certificate printing.
                      </p>

                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 cursor-pointer transition-colors">
                          {signatureUploading ? 'Uploading...' : 'Upload Signature'}
                          <input
                            type="file"
                            accept=".png,.jpg,.jpeg,.webp"
                            className="hidden"
                            disabled={signatureUploading}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setSignatureUploading(true);
                              try {
                                const res = await uploadAPI.uploadTutorSignature(file, true);
                                setProfile(prev => ({ ...prev, signature_image_url: res.url }));
                                setMessage({ type: 'success', text: 'Signature uploaded successfully.' });
                                setTimeout(() => setMessage(null), 2500);
                              } catch (error: unknown) {
                                const err = error as { response?: { data?: { detail?: string } } };
                                setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to upload signature' });
                                setTimeout(() => setMessage(null), 3000);
                              } finally {
                                setSignatureUploading(false);
                                e.currentTarget.value = '';
                              }
                            }}
                          />
                        </label>

                        {profile.signature_image_url && (
                          <img
                            src={profile.signature_image_url}
                            alt="Tutor signature"
                            className="h-10 max-w-[240px] object-contain bg-white border border-gray-200 rounded px-2 py-1"
                          />
                        )}
                      </div>
                    </div>

                    <div className="mt-5 border-t border-gray-100 pt-4">
                      <p className="text-sm font-semibold text-gray-900 mb-2">Certificate Preview</p>
                      <p className="text-xs text-gray-500 mb-3">
                        Preview final certificate with your signature and alignment before students download it.
                      </p>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={certificatePreviewForm.student_name}
                          onChange={(e) => setCertificatePreviewForm(prev => ({ ...prev, student_name: e.target.value }))}
                          placeholder="Student name"
                          className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <input
                          type="text"
                          value={certificatePreviewForm.subject}
                          onChange={(e) => setCertificatePreviewForm(prev => ({ ...prev, subject: e.target.value }))}
                          placeholder="Subject"
                          className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <input
                          type="text"
                          value={certificatePreviewForm.session_name}
                          onChange={(e) => setCertificatePreviewForm(prev => ({ ...prev, session_name: e.target.value }))}
                          placeholder="Session course name (optional)"
                          className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 sm:col-span-2"
                        />
                        <input
                          type="date"
                          value={certificatePreviewForm.session_date}
                          onChange={(e) => setCertificatePreviewForm(prev => ({ ...prev, session_date: e.target.value }))}
                          className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <button
                          onClick={handlePreviewCertificate}
                          disabled={previewLoading}
                          className="px-4 py-2 bg-secondary-600 text-white text-sm rounded-lg hover:bg-secondary-700 transition-colors disabled:opacity-50"
                        >
                          {previewLoading ? 'Generating...' : 'Open Certificate Preview'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Basic Info Card */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary-600" />
                  Professional Information
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Professional Headline</label>
                    <input
                      type="text"
                      value={profile.headline || ''}
                      onChange={(e) => setProfile(prev => ({ ...prev, headline: e.target.value }))}
                      placeholder="e.g., Expert Mathematics Tutor | PhD in Applied Mathematics"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                    <textarea
                      value={profile.bio || ''}
                      onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                      placeholder="Tell students about yourself, your teaching style, and what makes you unique..."
                      rows={4}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    />
                  </div>

                  <div className="grid md:grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <GraduationCap className="w-4 h-4 inline mr-1" />
                        Education
                      </label>
                      <input
                        type="text"
                        value={profile.education || ''}
                        onChange={(e) => setProfile(prev => ({ ...prev, education: e.target.value }))}
                        placeholder="e.g., PhD in Mathematics"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Award className="w-4 h-4 inline mr-1" />
                        Years of Experience
                      </label>
                      <input
                        type="number"
                        value={profile.experience_years || 0}
                        onChange={(e) => setProfile(prev => ({ ...prev, experience_years: parseInt(e.target.value) || 0 }))}
                        min="0"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        Country
                      </label>
                      <input
                        type="text"
                        value={profile.country || ''}
                        onChange={(e) => setProfile(prev => ({ ...prev, country: e.target.value }))}
                        placeholder="e.g., United States"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                      <input
                        type="text"
                        value={profile.city || ''}
                        onChange={(e) => setProfile(prev => ({ ...prev, city: e.target.value }))}
                        placeholder="e.g., New York"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing Card */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary-600" />
                  Pricing & Sessions
                </h2>

                {/* Session Types */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Session Types You Offer</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={profile.offers_private}
                        onChange={(e) => setProfile(prev => ({ ...prev, offers_private: e.target.checked }))}
                        className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500"
                      />
                      <Video className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">1-on-1 Sessions</span>
                    </label>
                    </div>
                </div>

                {/* Pricing Grid */}
                <div className="grid md:grid-cols-1 gap-4">
                  {/* 1-on-1 Rate */}
                  <div className={`p-4 rounded-xl border-2 transition-all ${profile.offers_private ? 'border-primary-200 bg-primary-50/50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Video className="w-5 h-5 text-primary-600" />
                      <label className="text-sm font-semibold text-gray-900">1-on-1 Session Rate</label>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
                      <input
                        type="number"
                        value={profile.hourly_rate || 0}
                        onChange={(e) => setProfile(prev => ({ ...prev, hourly_rate: parseFloat(e.target.value) || 0 }))}
                        min="0"
                        disabled={!profile.offers_private}
                        placeholder="Enter rate per hour"
                        className="w-full pl-8 pr-16 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">/hour</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Subjects Card */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary-600" />
                  Subjects You Teach
                </h2>

                {/* Selected Subjects Tags */}
                {profile.subjects && profile.subjects.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-600 mb-2">Your Selected Subjects</label>
                    <div className="flex flex-wrap gap-2">
                      {profile.subjects.map(subject => (
                        <span
                          key={subject}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-full text-sm font-medium"
                        >
                          {subject}
                          <button
                            onClick={() => removeSubject(subject)}
                            className="hover:bg-primary-700 rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Subject Input */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-600 mb-2">Add Custom Subject</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customSubjectInput}
                      onChange={(e) => setCustomSubjectInput(e.target.value)}
                      onKeyPress={handleSubjectKeyPress}
                      placeholder="Type a subject and press Enter..."
                      className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <button
                      onClick={addCustomSubject}
                      disabled={!customSubjectInput.trim()}
                      className="px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </div>

                {/* Suggested Subjects */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Or select from suggestions</label>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS_LIST.filter(s => !profile.subjects?.includes(s)).map(subject => (
                      <button
                        key={subject}
                        onClick={() => toggleSubject(subject)}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 bg-gray-100 text-gray-700 hover:bg-primary-100 hover:text-primary-700 border border-transparent hover:border-primary-200"
                      >
                        + {subject}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Languages Card */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Languages className="w-5 h-5 text-primary-600" />
                  Languages You Speak
                </h2>

                <div className="flex flex-wrap gap-2">
                  {LANGUAGES_LIST.map(lang => (
                    <button
                      key={lang}
                      onClick={() => toggleLanguage(lang)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                        profile.languages?.includes(lang)
                          ? 'bg-secondary-600 text-white shadow-lg shadow-secondary-500/25'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all duration-300 shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Save Profile
              </button>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-primary-600 to-secondary-600 rounded-2xl p-6 text-white">
                <h3 className="text-lg font-bold mb-4">Profile Completion</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Profile Photo', done: !!profile.avatar },
                    { label: 'Headline', done: !!profile.headline },
                    { label: 'Bio', done: !!profile.bio },
                    { label: 'Education', done: !!profile.education },
                    { label: 'Hourly Rate', done: (profile.hourly_rate || 0) > 0 },
                    { label: 'Subjects', done: (profile.subjects?.length || 0) > 0 },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${item.done ? 'bg-green-400' : 'bg-white/20'}`}>
                        {item.done && <Check className="w-4 h-4 text-white" />}
                      </div>
                      <span className={item.done ? 'opacity-100' : 'opacity-60'}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Tips</h3>
                <ul className="space-y-3 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Add a professional photo to increase bookings by 40%
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Write a detailed bio highlighting your expertise
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Set competitive rates based on your experience
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        {/* Availability Tab */}
        {activeTab === 'availability' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary-600" />
              Set Your Weekly Availability
            </h2>

            <p className="text-gray-600 mb-8">
              Define your private session weekly schedule.
            </p>

            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Duration
              </label>
              <select
                value={sessionDuration}
                onChange={(e) => setSessionDuration(Math.max(15, Number(e.target.value) || 60))}
                className="w-full sm:w-64 px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                Student booking time options are generated using this duration.
              </p>
            </div>

            <div className="space-y-4">
              {DAYS_OF_WEEK.map((day, index) => (
                <div key={day} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-20 font-semibold text-gray-900 pt-2 capitalize">
                    {DAY_LABELS[index]}
                  </div>

                  <div className="flex-1 space-y-2">
                    {privateWeeklySchedule[day].length === 0 ? (
                      <div className="text-gray-400 italic py-2">No availability set</div>
                    ) : (
                      privateWeeklySchedule[day].map((slot, slotIndex) => (
                        <div key={slotIndex} className="flex items-center gap-3">
                          <input
                            type="time"
                            value={slot.start_time}
                            onChange={(e) => updateTimeSlot(day, slotIndex, 'start_time', e.target.value)}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <span className="text-gray-500">to</span>
                          <input
                            type="time"
                            value={slot.end_time}
                            onChange={(e) => updateTimeSlot(day, slotIndex, 'end_time', e.target.value)}
                            className="px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                          <button
                            onClick={() => removeTimeSlot(day, slotIndex)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    onClick={() => addTimeSlot(day)}
                    className="flex items-center gap-1 px-3 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Slot
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleSaveAvailability}
              disabled={saving}
              className="mt-8 w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all duration-300 shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              Save Private Schedule
            </button>
          </motion.div>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="grid lg:grid-cols-3 gap-8"
          >
            {/* Calendar */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
              {/* Calendar Header */}
              <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h2>
                    <p className="text-primary-100 text-sm mt-1">Manage your availability calendar</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={prevMonth}
                      className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl transition-colors text-white"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={nextMonth}
                      className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl transition-colors text-white"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2">
                {/* Day Headers */}
                {DAY_LABELS.map((day, idx) => (
                  <div
                    key={day}
                    className={`p-3 text-center text-sm font-semibold rounded-lg ${
                      idx >= 5 ? 'text-rose-500 bg-rose-50' : 'text-gray-700 bg-gray-50'
                    }`}
                  >
                    {day}
                  </div>
                ))}

                {/* Calendar Days */}
                {getCalendarGrid().map((day, index) => (
                  <div
                    key={index}
                    className="aspect-square"
                  >
                    {day && (
                      <button
                        onClick={() => {
                          const today = new Date().toISOString().split('T')[0];
                          if (day.date >= today) {
                            setSelectedDate(day.date);
                          }
                        }}
                        disabled={day.date < new Date().toISOString().split('T')[0]}
                        className={`w-full h-full rounded-xl flex flex-col items-center justify-center transition-all duration-300 ${getDayStyle(day)} ${
                          selectedDate === day.date ? 'ring-2 ring-primary-500 ring-offset-2' : ''
                        } ${day.date === new Date().toISOString().split('T')[0] ? 'ring-2 ring-blue-400' : ''}`}
                      >
                        <span className="text-base font-bold">
                          {parseInt(day.date.split('-')[2])}
                        </span>
                        {day.is_blocked && (
                          <span className="text-[10px] font-medium mt-0.5">Blocked</span>
                        )}
                        {hasBookings(day.date) && !day.is_blocked && (
                          <span className="text-[10px] font-medium mt-0.5">{getBookingsForDate(day.date).length} booked</span>
                        )}
                        {day.is_available && day.slots_count > 0 && !day.is_blocked && !hasBookings(day.date) && (
                          <span className="text-[10px] font-medium mt-0.5">{day.slots_count} slots</span>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                  <div className="w-4 h-4 rounded-md bg-blue-100 border-2 border-blue-300" />
                  <span className="text-sm font-medium text-blue-700">Booked</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-lg">
                  <div className="w-4 h-4 rounded-md bg-emerald-100 border border-emerald-200" />
                  <span className="text-sm font-medium text-emerald-700">Available</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg">
                  <div className="w-4 h-4 rounded-md bg-red-200 border border-red-300" />
                  <span className="text-sm font-medium text-red-700">Blocked/Leave</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                  <div className="w-4 h-4 rounded-md bg-gray-100 border border-gray-200" />
                  <span className="text-sm font-medium text-gray-500">No Schedule Set</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                  <div className="w-4 h-4 rounded-md bg-white border-2 border-blue-400" />
                  <span className="text-sm font-medium text-blue-600">Today</span>
                </div>
              </div>
              </div>
            </div>

            {/* Block Date Panel */}
            <div className="space-y-6">
              {/* Jitsi Setup */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Video className="w-5 h-5 text-primary-600" />
                  Jitsi Meeting Setup
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Test your camera, microphone, and moderator access before live student sessions.
                </p>

                <button
                  onClick={handleStartJitsiTestMeeting}
                  disabled={jitsiTestLoading}
                  className="w-full py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {jitsiTestLoading ? 'Opening Test Room...' : 'Start Jitsi Test Meeting'}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Opens a private test room in a new tab.
                </p>
              </div>

              {/* Block Date Form */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Block a Date</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Click on a date in the calendar or enter one below to mark it as unavailable.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                    <input
                      type="date"
                      value={selectedDate || ''}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reason (optional)</label>
                    <input
                      type="text"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="e.g., Personal leave, Holiday"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <button
                    onClick={handleBlockDate}
                    disabled={!selectedDate}
                    className="w-full py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Block This Date
                  </button>
                </div>
              </div>

              {/* Blocked Dates List */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Blocked Dates</h3>

                {blockedDates.length === 0 ? (
                  <p className="text-gray-500 text-sm">No blocked dates</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {blockedDates.map(blocked => (
                      <div
                        key={blocked.id}
                        className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium text-red-700">
                            {new Date(blocked.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                          {blocked.reason && (
                            <div className="text-sm text-red-600">{blocked.reason}</div>
                          )}
                        </div>
                        <button
                          onClick={() => handleUnblockDate(blocked.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </motion.div>
        )}

        {/* Session Bookings Tab */}
        {activeTab === 'bookings' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Video className="w-5 h-5 text-primary-600" />
                Session Bookings
              </h3>

              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  { key: 'upcoming', label: 'Upcoming' },
                  { key: 'private', label: 'Private' },
                  { key: 'finished', label: 'Finished' },
                  { key: 'cancelled', label: 'Cancelled' },
                ].map(view => (
                  <button
                    key={view.key}
                    onClick={() => setBookingView(view.key as typeof bookingView)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      bookingView === view.key
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>

              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                {bookingViewLabels[bookingView]} ({currentBookings.length})
              </h4>

              {currentBookings.length === 0 ? (
                <p className="text-gray-500 text-sm">No {bookingViewLabels[bookingView].toLowerCase()}</p>
              ) : (
                <div className="space-y-4 max-h-[700px] overflow-y-auto">
                  {currentBookings.map(booking => (
                    <div
                      key={booking.id}
                      className={`p-4 rounded-xl border ${
                        booking.status === 'confirmed' ? 'bg-green-50 border-green-200' :
                        booking.status === 'pending' ? 'bg-yellow-50 border-yellow-200' :
                        'bg-blue-50 border-blue-100'
                      }`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {booking.student_name || 'Student'}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {booking.subject}
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                          booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {booking.status}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:items-center sm:gap-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(booking.scheduled_at).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(booking.scheduled_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>

                      <div className="mt-2 text-sm font-medium text-gray-700">
                        {booking.currency === 'INR' ? 'Rs ' : '$'}{booking.price.toFixed(2)} | {booking.duration_minutes} min | {booking.session_type}
                      </div>

                      {booking.status === 'confirmed' && (
                        <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                          {booking.meeting_link ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <Video className="w-4 h-4 text-green-600" />
                                Session Link
                              </div>
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <input
                                  type="text"
                                  value={booking.meeting_link}
                                  readOnly
                                  className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg"
                                />
                                <button
                                  onClick={() => copyToClipboard(booking.meeting_link!)}
                                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                  title="Copy link"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                                <a
                                  href={booking.meeting_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                  title="Open Session"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                              <p className="text-xs text-gray-500">
                                Link source: {getMeetingOriginLabel(booking.meeting_origin)}
                              </p>
                            </div>
                          ) : booking.meeting_link_expired ? (
                            <div className="flex items-center gap-2 text-sm text-red-700">
                              <AlertCircle className="w-4 h-4" />
                              Session link expired (15 minutes after session end).
                            </div>
                          ) : editingMeetLink === booking.id ? (
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-gray-700">Add Session Link</div>
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <input
                                  type="url"
                                  value={meetLinkInput}
                                  onChange={(e) => setMeetLinkInput(e.target.value)}
                                  placeholder="https://easystudy.cloud/meeting/..."
                                  className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                                <button
                                  onClick={() => handleUpdateMeetLink(booking.id)}
                                  disabled={actionLoading === booking.id}
                                  className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                                >
                                  {actionLoading === booking.id ? '...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => { setEditingMeetLink(null); setMeetLinkInput(''); }}
                                  className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingMeetLink(booking.id)}
                              className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                            >
                              <Link className="w-4 h-4" />
                              Add Meet link manually
                            </button>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        {booking.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleConfirmBooking(booking.id)}
                              disabled={actionLoading === booking.id}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              {actionLoading === booking.id ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-4 h-4" />
                                  Confirm
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleCancelBooking(booking.id)}
                              disabled={actionLoading === booking.id}
                              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                            >
                              <X className="w-4 h-4" />
                              Decline
                            </button>
                          </>
                        )}
                        {booking.status === 'confirmed' && (
                          <button
                            onClick={() => handleCancelBooking(booking.id)}
                            disabled={actionLoading === booking.id}
                            className="flex items-center justify-center gap-1 px-3 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                            Cancel Booking
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Workshops Tab */}
        {activeTab === 'workshops' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Workshops</h2>
                <p className="text-gray-600">Create and manage workshop listings with modules, schedule, thumbnail, and pricing.</p>
              </div>
              <button
                onClick={openCreateWorkshop}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Workshop
              </button>
            </div>

            {showWorkshopForm && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingWorkshopId ? 'Edit Workshop' : 'Create Workshop'}
                </h3>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Workshop Title</label>
                    <input
                      type="text"
                      value={workshopForm.title}
                      onChange={(e) => setWorkshopForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter workshop title"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date & Time</label>
                    <input
                      type="datetime-local"
                      value={workshopForm.scheduled_at}
                      onChange={(e) => setWorkshopForm(prev => ({ ...prev, scheduled_at: e.target.value }))}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={workshopForm.description || ''}
                    onChange={(e) => setWorkshopForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    placeholder="Enter workshop description"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  />
                </div>

                <div className="grid md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                    <input
                      type="number"
                      min={0}
                      value={workshopForm.amount}
                      onChange={(e) => setWorkshopForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                    <input
                      type="text"
                      value={workshopForm.currency}
                      onChange={(e) => setWorkshopForm(prev => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                      placeholder="INR"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration (Minutes)</label>
                    <input
                      type="number"
                      min={15}
                      value={workshopForm.duration_minutes}
                      onChange={(e) => setWorkshopForm(prev => ({ ...prev, duration_minutes: Math.max(15, parseInt(e.target.value) || 60) }))}
                      placeholder="60"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Participants</label>
                    <input
                      type="number"
                      min={1}
                      value={workshopForm.max_participants}
                      onChange={(e) => setWorkshopForm(prev => ({ ...prev, max_participants: Math.max(1, parseInt(e.target.value) || 1) }))}
                      placeholder="50"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Modules</label>
                  <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={workshopModuleInput}
                    onChange={(e) => setWorkshopModuleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addWorkshopModule();
                      }
                    }}
                    placeholder="Add module and press Enter"
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={addWorkshopModule}
                    className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
                  >
                    Add Module
                  </button>
                  </div>
                </div>
                {workshopForm.modules.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {workshopForm.modules.map(module => (
                      <span key={module} className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm">
                        {module}
                        <button onClick={() => removeWorkshopModule(module)} className="hover:text-primary-900">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Workshop Thumbnail</p>
                  <ImageUpload
                    type="workshop"
                    currentImage={workshopForm.thumbnail_url}
                    onUploadSuccess={(url) => setWorkshopForm(prev => ({ ...prev, thumbnail_url: url }))}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSaveWorkshop}
                    disabled={workshopSaving}
                    className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50"
                  >
                    {workshopSaving ? 'Saving...' : (editingWorkshopId ? 'Update Workshop' : 'Create Workshop')}
                  </button>
                  <button
                    onClick={resetWorkshopForm}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              {workshops.length === 0 ? (
                <p className="text-gray-500 text-sm">No workshops yet.</p>
              ) : (
                <div className="space-y-4">
                  {workshops.map((workshop) => (
                    <div key={workshop.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-gray-900">{workshop.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {new Date(workshop.scheduled_at).toLocaleString()} | {workshop.duration_minutes} mins | {workshop.max_participants} seats
                          </p>
                          <p className="text-sm text-gray-700 mt-1">{workshop.currency} {workshop.amount.toFixed(2)}</p>
                          {workshop.modules?.length > 0 && (
                            <p className="text-xs text-gray-600 mt-1">Modules: {workshop.modules.join(', ')}</p>
                          )}
                        </div>
                        {workshop.thumbnail_url && (
                          <img src={workshop.thumbnail_url} alt={workshop.title} className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
                        )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => openEditWorkshop(workshop)}
                          className="px-3 py-1.5 text-sm bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteWorkshop(workshop.id)}
                          className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Materials Tab */}
        {activeTab === 'materials' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Reading Materials</h2>
                <p className="text-gray-600">Upload and manage ebooks, PDFs, and study materials for your students</p>
              </div>
              <button
                onClick={() => {
                  fetchBookedStudents();
                  setShareWithAll(true);
                  setSelectedStudents([]);
                  setShowMaterialForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Material
              </button>
            </div>

            {/* Add Material Form Modal */}
            {showMaterialForm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
                >
                  <div className="px-6 pt-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Material</h3>
                  </div>
                  <div className="px-6 overflow-y-auto flex-1">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                        <input
                          type="text"
                          value={materialForm.title}
                          onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
                          placeholder="e.g., Introduction to Calculus"
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                        <select
                          value={materialForm.subject}
                          onChange={(e) => setMaterialForm({ ...materialForm, subject: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">Select Subject</option>
                          {profile.subjects?.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        <textarea
                          value={materialForm.description}
                          onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                          placeholder="Brief description of the material..."
                          rows={3}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Share With</label>
                        <div className="space-y-3">
                          <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                            <input
                              type="radio"
                              name="shareWith"
                              checked={shareWithAll}
                              onChange={() => {
                                setShareWithAll(true);
                                setSelectedStudents([]);
                              }}
                              className="w-4 h-4 text-primary-600"
                            />
                            <div>
                              <span className="font-medium text-gray-900">All Students</span>
                              <p className="text-xs text-gray-500">Share with all students who booked with you</p>
                            </div>
                          </label>
                          <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                            <input
                              type="radio"
                              name="shareWith"
                              checked={!shareWithAll}
                              onChange={() => setShareWithAll(false)}
                              className="w-4 h-4 text-primary-600"
                            />
                            <div>
                              <span className="font-medium text-gray-900">Specific Students</span>
                              <p className="text-xs text-gray-500">Select individual students to share with</p>
                            </div>
                          </label>
                          {!shareWithAll && (
                            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                              {bookedStudents.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-2">No students have booked with you yet</p>
                              ) : (
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {bookedStudents.map(student => (
                                    <label key={student.id} className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedStudents.includes(student.id)}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedStudents([...selectedStudents, student.id]);
                                          } else {
                                            setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                                          }
                                        }}
                                        className="w-4 h-4 text-primary-600 rounded"
                                      />
                                      <div>
                                        <span className="text-sm font-medium text-gray-900">{student.name}</span>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Upload File (PDF, DOC, etc.)</label>
                        <label className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-primary-400 transition-colors cursor-pointer block">
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.doc,.docx,.ppt,.pptx"
                            onChange={(e) => setMaterialFile(e.target.files?.[0] || null)}
                          />
                          <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                          {materialFile ? (
                            <p className="text-sm text-primary-600 font-medium">{materialFile.name}</p>
                          ) : (
                            <>
                              <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                              <p className="text-xs text-gray-400 mt-1">PDF, DOC, DOCX, PPT up to 10MB</p>
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 p-6 border-t border-gray-100 bg-white">
                    <button
                      onClick={() => {
                        setShowMaterialForm(false);
                        setMaterialFile(null);
                      }}
                      className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setMaterialLoading(true);
                        try {
                          const formData = new FormData();
                          formData.append('title', materialForm.title);
                          formData.append('description', materialForm.description);
                          formData.append('subject', materialForm.subject);
                          formData.append('shared_with_all', shareWithAll.toString());
                          formData.append('student_ids', selectedStudents.join(','));
                          if (materialFile) {
                            formData.append('file', materialFile);
                          }
                          const newMaterial = await materialsAPI.createMaterial(formData);
                          setMaterials([newMaterial, ...materials]);
                          setMaterialForm({ title: '', description: '', subject: '' });
                          setShareWithAll(true);
                          setSelectedStudents([]);
                          setMaterialFile(null);
                          setShowMaterialForm(false);
                          setMessage({ type: 'success', text: 'Material added successfully!' });
                          setTimeout(() => setMessage(null), 3000);
                        } catch (error) {
                          console.error('Failed to add material:', error);
                          setMessage({ type: 'error', text: 'Failed to add material. Please try again.' });
                          setTimeout(() => setMessage(null), 3000);
                        } finally {
                          setMaterialLoading(false);
                        }
                      }}
                      disabled={!materialForm.title || !materialForm.subject || materialLoading}
                      className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {materialLoading ? 'Adding...' : 'Add Material'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Materials List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {materials.length === 0 ? (
                <div className="p-12 text-center">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Materials Yet</h3>
                  <p className="text-gray-500 mb-4">Start by adding your first reading material for students</p>
                  <button
                    onClick={() => {
                      fetchBookedStudents();
                      setShareWithAll(true);
                      setSelectedStudents([]);
                      setShowMaterialForm(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-xl hover:bg-primary-200 transition-colors font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    Add Your First Material
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {materials.map(material => (
                    <div key={material.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-primary-100 rounded-xl">
                            <FileText className="w-6 h-6 text-primary-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{material.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{material.description}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{material.subject}</span>
                              <span className="text-xs text-gray-400">
                                Added {new Date(material.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {material.file_url && (
                            <a
                              href={material.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            >
                              <Download className="w-5 h-5" />
                            </a>
                          )}
                          <button
                            onClick={async () => {
                              try {
                                await materialsAPI.deleteMaterial(material.id);
                                setMaterials(materials.filter(m => m.id !== material.id));
                                setMessage({ type: 'success', text: 'Material deleted successfully!' });
                                setTimeout(() => setMessage(null), 3000);
                              } catch (error) {
                                console.error('Failed to delete material:', error);
                                setMessage({ type: 'error', text: 'Failed to delete material.' });
                                setTimeout(() => setMessage(null), 3000);
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Assignments Tab */}
        {activeTab === 'assignments' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Assignments & Projects</h2>
                <p className="text-gray-600">Create and manage assignments for your students</p>
              </div>
              <button
                onClick={() => {
                  fetchBookedStudents();
                  setAssignmentShareWithAll(true);
                  setAssignmentSelectedStudents([]);
                  setShowAssignmentForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Assignment
              </button>
            </div>

            {/* Add Assignment Form Modal */}
            {showAssignmentForm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-2xl p-6 w-full max-w-lg"
                >
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Create New Assignment</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                      <input
                        type="text"
                        value={assignmentForm.title}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                        placeholder="e.g., Chapter 5 Exercises"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                      <select
                        value={assignmentForm.subject}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, subject: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">Select Subject</option>
                        {profile.subjects?.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                      <textarea
                        value={assignmentForm.description}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                        placeholder="Assignment instructions and details..."
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                        <input
                          type="date"
                          value={assignmentForm.due_date}
                          onChange={(e) => setAssignmentForm({ ...assignmentForm, due_date: e.target.value })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Max Marks</label>
                        <input
                          type="number"
                          value={assignmentForm.max_marks}
                          onChange={(e) => setAssignmentForm({ ...assignmentForm, max_marks: parseInt(e.target.value) || 100 })}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Assign To</label>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                          <input
                            type="radio"
                            name="assignmentShareWith"
                            checked={assignmentShareWithAll}
                            onChange={() => {
                              setAssignmentShareWithAll(true);
                              setAssignmentSelectedStudents([]);
                            }}
                            className="w-4 h-4 text-primary-600"
                          />
                          <div>
                            <span className="font-medium text-gray-900">All Booked Students</span>
                            <p className="text-xs text-gray-500">Assign to all students who booked with you</p>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                          <input
                            type="radio"
                            name="assignmentShareWith"
                            checked={!assignmentShareWithAll}
                            onChange={() => setAssignmentShareWithAll(false)}
                            className="w-4 h-4 text-primary-600"
                          />
                          <div>
                            <span className="font-medium text-gray-900">Specific Students</span>
                            <p className="text-xs text-gray-500">Select booked students only</p>
                          </div>
                        </label>
                        {!assignmentShareWithAll && (
                          <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                            {bookedStudents.length === 0 ? (
                              <p className="text-sm text-gray-500 text-center py-2">No students have booked with you yet</p>
                            ) : (
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {bookedStudents.map(student => (
                                  <label key={student.id} className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={assignmentSelectedStudents.includes(student.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setAssignmentSelectedStudents([...assignmentSelectedStudents, student.id]);
                                        } else {
                                          setAssignmentSelectedStudents(assignmentSelectedStudents.filter(id => id !== student.id));
                                        }
                                      }}
                                      className="w-4 h-4 text-primary-600 rounded"
                                    />
                                    <div>
                                      <span className="text-sm font-medium text-gray-900">{student.name}</span>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setShowAssignmentForm(false);
                        setAssignmentShareWithAll(true);
                        setAssignmentSelectedStudents([]);
                      }}
                      className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setAssignmentLoading(true);
                        try {
                          if (!assignmentShareWithAll && assignmentSelectedStudents.length === 0) {
                            setMessage({ type: 'error', text: 'Select at least one booked student for this assignment.' });
                            setTimeout(() => setMessage(null), 3000);
                            setAssignmentLoading(false);
                            return;
                          }
                          const newAssignment = await materialsAPI.createAssignment({
                            title: assignmentForm.title,
                            description: assignmentForm.description,
                            subject: assignmentForm.subject,
                            due_date: assignmentForm.due_date,
                            max_marks: assignmentForm.max_marks,
                            shared_with_all: assignmentShareWithAll,
                            student_ids: assignmentShareWithAll ? [] : assignmentSelectedStudents
                          });
                          setAssignments([newAssignment, ...assignments]);
                          setAssignmentForm({ title: '', description: '', subject: '', due_date: '', max_marks: 100 });
                          setAssignmentShareWithAll(true);
                          setAssignmentSelectedStudents([]);
                          setShowAssignmentForm(false);
                          setMessage({ type: 'success', text: 'Assignment created successfully!' });
                          setTimeout(() => setMessage(null), 3000);
                        } catch (error) {
                          console.error('Failed to create assignment:', error);
                          setMessage({ type: 'error', text: 'Failed to create assignment. Please try again.' });
                          setTimeout(() => setMessage(null), 3000);
                        } finally {
                          setAssignmentLoading(false);
                        }
                      }}
                      disabled={!assignmentForm.title || !assignmentForm.subject || !assignmentForm.due_date || assignmentLoading}
                      className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {assignmentLoading ? 'Creating...' : 'Create Assignment'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Assignments List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {assignments.length === 0 ? (
                <div className="p-12 text-center">
                  <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Assignments Yet</h3>
                  <p className="text-gray-500 mb-4">Create your first assignment for students</p>
                  <button
                    onClick={() => {
                      fetchBookedStudents();
                      setAssignmentShareWithAll(true);
                      setAssignmentSelectedStudents([]);
                      setShowAssignmentForm(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-xl hover:bg-primary-200 transition-colors font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    Create Your First Assignment
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {assignments.map(assignment => (
                    <div key={assignment.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-xl ${
                            assignment.status === 'graded' ? 'bg-green-100' :
                            assignment.status === 'submitted' ? 'bg-blue-100' : 'bg-yellow-100'
                          }`}>
                            <ClipboardList className={`w-6 h-6 ${
                              assignment.status === 'graded' ? 'text-green-600' :
                              assignment.status === 'submitted' ? 'text-blue-600' : 'text-yellow-600'
                            }`} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{assignment.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{assignment.description}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{assignment.subject}</span>
                              <span className="text-xs text-gray-500">Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                              <span className="text-xs text-gray-500">Max Marks: {assignment.max_marks}</span>
                              {assignment.submission_date && (
                                <span className="text-xs text-blue-600">Submitted: {new Date(assignment.submission_date).toLocaleDateString()}</span>
                              )}
                              {assignment.obtained_marks !== undefined && assignment.obtained_marks !== null && (
                                <span className="text-xs text-green-700">Marks: {assignment.obtained_marks}/{assignment.max_marks}</span>
                              )}
                            </div>
                            {assignment.submission_url && (
                              <div className="mt-2">
                                <a
                                  href={assignment.submission_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary-600 hover:text-primary-700 underline"
                                >
                                  View Student Submission
                                </a>
                              </div>
                            )}
                            {assignment.feedback && (
                              <p className="text-xs text-gray-600 mt-2"><strong>Feedback:</strong> {assignment.feedback}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(assignment.status === 'submitted' || assignment.status === 'graded') && (
                            <button
                              onClick={async () => {
                                const marksInput = window.prompt(
                                  `Enter obtained marks (0-${assignment.max_marks})`,
                                  assignment.obtained_marks?.toString() || ''
                                );
                                if (marksInput === null) return;

                                const trimmedMarks = marksInput.trim();
                                const parsedMarks = trimmedMarks === '' ? undefined : Number(trimmedMarks);
                                if (parsedMarks !== undefined && (!Number.isFinite(parsedMarks) || parsedMarks < 0 || parsedMarks > assignment.max_marks)) {
                                  setMessage({ type: 'error', text: `Marks must be between 0 and ${assignment.max_marks}.` });
                                  setTimeout(() => setMessage(null), 3000);
                                  return;
                                }

                                const feedbackInput = window.prompt(
                                  'Enter feedback for student (optional)',
                                  assignment.feedback || ''
                                );
                                if (feedbackInput === null) return;

                                try {
                                  const updated = await materialsAPI.gradeAssignment(assignment.id, {
                                    obtained_marks: parsedMarks,
                                    feedback: feedbackInput || undefined,
                                  });
                                  setAssignments(prev => prev.map(a => (a.id === assignment.id ? updated : a)));
                                  setMessage({ type: 'success', text: 'Assignment result updated successfully!' });
                                  setTimeout(() => setMessage(null), 2500);
                                } catch (error) {
                                  console.error('Failed to update assignment result:', error);
                                  setMessage({ type: 'error', text: 'Failed to update assignment result.' });
                                  setTimeout(() => setMessage(null), 3000);
                                }
                              }}
                              className="px-3 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                            >
                              {assignment.status === 'graded' ? 'Update Result' : 'Grade'}
                            </button>
                          )}
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                            assignment.status === 'graded' ? 'bg-green-100 text-green-700' :
                            assignment.status === 'submitted' ? 'bg-blue-100 text-blue-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {assignment.status}
                          </span>
                          <button
                            onClick={async () => {
                              try {
                                await materialsAPI.deleteAssignment(assignment.id);
                                setAssignments(assignments.filter(a => a.id !== assignment.id));
                                setMessage({ type: 'success', text: 'Assignment deleted successfully!' });
                                setTimeout(() => setMessage(null), 3000);
                              } catch (error) {
                                console.error('Failed to delete assignment:', error);
                                setMessage({ type: 'error', text: 'Failed to delete assignment.' });
                                setTimeout(() => setMessage(null), 3000);
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Feedback Tab */}
        {activeTab === 'feedback' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Header */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Student Feedback & Evaluation</h2>
              <p className="text-gray-600">View feedback and ratings from your students</p>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-yellow-100 rounded-xl">
                    <Star className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {feedbacks.length > 0
                        ? (feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length).toFixed(1)
                        : '0.0'}
                    </div>
                    <div className="text-sm text-gray-500">Average Rating</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <MessageSquare className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{feedbacks.length}</div>
                    <div className="text-sm text-gray-500">Total Reviews</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-xl">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {new Set(feedbacks.map(f => f.student_name)).size}
                    </div>
                    <div className="text-sm text-gray-500">Unique Students</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feedback List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {feedbacks.length === 0 ? (
                <div className="p-12 text-center">
                  <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Feedback Yet</h3>
                  <p className="text-gray-500">Feedback from your students will appear here after sessions</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {feedbacks.map(feedback => (
                    <div key={feedback.id} className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold">
                          {feedback.student_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-gray-900">{feedback.student_name}</h4>
                              <p className="text-sm text-gray-500">{feedback.subject}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-5 h-5 ${i < feedback.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-gray-700 mt-3">{feedback.comment}</p>
                          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                            {feedback.session_date && <span>Session: {new Date(feedback.session_date).toLocaleDateString()}</span>}
                            <span>Reviewed: {new Date(feedback.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Messages</h2>
              <p className="text-gray-600">Chat with your students.</p>
            </div>
            <ChatInbox mode="tutor" />
          </motion.div>
        )}

        {/* Earnings Tab */}
        {activeTab === 'earnings' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Stats Cards */}
            {tutorStats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <DollarSign className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {tutorStats.currency} {tutorStats.total_earnings.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-500">Total Earnings</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <Wallet className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {tutorStats.currency} {tutorStats.available_balance.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-500">Available Balance</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-xl">
                      <TrendingUp className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{tutorStats.completed_sessions}</div>
                      <div className="text-sm text-gray-500">Sessions Completed</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-100 rounded-xl">
                      <ArrowDownCircle className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {tutorStats.currency} {tutorStats.withdrawn_amount.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-500">Total Withdrawn</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Monthly Stats & Withdrawal Request */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Monthly Stats */}
              {tutorStats && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary-600" />
                    This Month
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                      <span className="text-gray-600">Sessions</span>
                      <span className="text-xl font-bold text-gray-900">{tutorStats.monthly_sessions}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                      <span className="text-gray-600">Earnings</span>
                      <span className="text-xl font-bold text-green-600">
                        {tutorStats.currency} {tutorStats.monthly_earnings.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                      <span className="text-gray-600">Pending Sessions</span>
                      <span className="text-xl font-bold text-yellow-600">{tutorStats.pending_sessions}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                      <span className="text-gray-600">Pending Withdrawals</span>
                      <span className="text-xl font-bold text-orange-600">
                        {tutorStats.currency} {tutorStats.pending_withdrawals.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Request Withdrawal */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ArrowDownCircle className="w-5 h-5 text-primary-600" />
                  Request Withdrawal
                </h3>

                <div className="space-y-4">
                  {/* Available Balance Display */}
                  {tutorStats && (
                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                      <div className="text-sm text-gray-600 mb-1">Available for Withdrawal</div>
                      <div className="text-2xl font-bold text-green-700">
                        {tutorStats.currency} {tutorStats.available_balance.toFixed(2)}
                      </div>
                    </div>
                  )}

                  {/* Amount Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                        {tutorStats?.currency || 'INR'}
                      </span>
                      <input
                        type="number"
                        value={withdrawalAmount}
                        onChange={(e) => setWithdrawalAmount(e.target.value)}
                        placeholder="Enter amount"
                        min="0"
                        step="0.01"
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    {tutorStats && (tutorStats.minimum_withdrawal_amount ?? 0) > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Minimum withdrawal: {tutorStats.currency} {(tutorStats.minimum_withdrawal_amount ?? 10).toFixed(2)}
                      </p>
                    )}
                    {withdrawalAmount && tutorStats && parseFloat(withdrawalAmount) < (tutorStats.minimum_withdrawal_amount ?? 10) && (
                      <p className="text-xs text-red-500 mt-1">
                        Amount must be at least {tutorStats.currency} {(tutorStats.minimum_withdrawal_amount ?? 10).toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Payment Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setPaymentMethod('bank_transfer')}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          paymentMethod === 'bank_transfer'
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Building className="w-5 h-5" />
                        <span className="text-xs font-medium">Bank</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('upi')}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          paymentMethod === 'upi'
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Smartphone className="w-5 h-5" />
                        <span className="text-xs font-medium">UPI</span>
                      </button>
                      <button
                        onClick={() => setPaymentMethod('paypal')}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          paymentMethod === 'paypal'
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <CreditCard className="w-5 h-5" />
                        <span className="text-xs font-medium">PayPal</span>
                      </button>
                    </div>
                  </div>

                  {/* Payment Details */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {paymentMethod === 'bank_transfer' ? 'Bank Account Details' :
                       paymentMethod === 'upi' ? 'UPI ID' : 'PayPal Email'}
                    </label>
                    <textarea
                      value={paymentDetails}
                      onChange={(e) => setPaymentDetails(e.target.value)}
                      placeholder={
                        paymentMethod === 'bank_transfer'
                          ? 'Enter bank name, account number, IFSC code...'
                          : paymentMethod === 'upi'
                          ? 'Enter your UPI ID (e.g., name@upi)'
                          : 'Enter your PayPal email address'
                      }
                      rows={paymentMethod === 'bank_transfer' ? 3 : 1}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleWithdrawalRequest}
                    disabled={withdrawalLoading || !withdrawalAmount || !paymentDetails || (tutorStats ? parseFloat(withdrawalAmount) < (tutorStats.minimum_withdrawal_amount ?? 10) : false)}
                    className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all duration-300 shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {withdrawalLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <ArrowDownCircle className="w-5 h-5" />
                        Request Withdrawal
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Today / Weekly / Monthly Analysis */}
            {tutorStats && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary-600" />
                  Weekly & Monthly Analysis
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                    <p className="text-sm text-gray-500 mb-1">Today</p>
                    <p className="text-lg font-bold text-green-700">
                      {tutorStats.currency} {earningsAnalysis.todayEarnings.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{earningsAnalysis.todaySessions} sessions</p>
                  </div>
                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                    <p className="text-sm text-gray-500 mb-1">This Week</p>
                    <p className="text-lg font-bold text-blue-700">
                      {tutorStats.currency} {earningsAnalysis.weeklyEarnings.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{earningsAnalysis.weeklySessions} sessions</p>
                  </div>
                  <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                    <p className="text-sm text-gray-500 mb-1">This Month</p>
                    <p className="text-lg font-bold text-purple-700">
                      {tutorStats.currency} {earningsAnalysis.monthlyEarnings.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{earningsAnalysis.monthlySessions} sessions</p>
                  </div>
                </div>
              </div>
            )}

            {/* Payment List */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-600" />
                Payment List
              </h3>

              <div className="grid md:grid-cols-4 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From Date</label>
                  <input
                    type="date"
                    value={paymentFilterFrom}
                    onChange={(e) => setPaymentFilterFrom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To Date</label>
                  <input
                    type="date"
                    value={paymentFilterTo}
                    onChange={(e) => setPaymentFilterTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Status</label>
                  <select
                    value={paymentFilterStatus}
                    onChange={(e) => setPaymentFilterStatus(e.target.value as 'all' | 'completed' | 'pending' | 'failed' | 'refunded')}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                  >
                    <option value="all">All</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Student Name</label>
                  <input
                    type="text"
                    value={paymentFilterStudent}
                    onChange={(e) => setPaymentFilterStudent(e.target.value)}
                    placeholder="Search student..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                  />
                </div>
              </div>

              {filteredTutorPayments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No payments found for selected filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Time</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Student Name</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Amount</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Invoice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTutorPayments.map((p) => {
                        const schedule = p.scheduled_at ? new Date(p.scheduled_at) : null;
                        return (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 text-sm text-gray-700">
                              {schedule ? schedule.toLocaleDateString() : '-'}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-700">
                              {schedule ? schedule.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </td>
                            <td className="px-4 py-4 text-sm font-medium text-gray-800">
                              {p.student_name || 'Student'}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-700">
                              {p.currency} {p.tutor_earnings.toFixed(2)}
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                                p.status === 'completed'
                                  ? 'bg-green-100 text-green-700'
                                  : p.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : p.status === 'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <button
                                onClick={() => handleDownloadTutorInvoice(p.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Withdrawal History */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary-600" />
                Withdrawal History
              </h3>

              {withdrawals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ArrowDownCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No withdrawal requests yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Amount</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Method</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {withdrawals.map(w => (
                        <tr key={w.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 text-sm text-gray-600">
                            {new Date(w.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-4 font-medium">
                            {w.currency} {w.amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 capitalize">
                            {w.payment_method.replace('_', ' ')}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                              w.status === 'completed' ? 'bg-green-100 text-green-700' :
                              w.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                              w.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {w.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {w.admin_notes || '-'}
                            {w.transaction_id && (
                              <div className="text-xs text-gray-400 mt-1">
                                Txn: {w.transaction_id}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorDashboard;


