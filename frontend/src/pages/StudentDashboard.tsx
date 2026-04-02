import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Calendar, Clock, Video, DollarSign,
  Check, X, AlertCircle, ExternalLink, Copy, User,
  FileText, Star, MessageSquare, Download, BookOpen, ClipboardList
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { bookingsAPI, materialsAPI } from '../services/api';
import type { AssignmentResponse, BookingResponse, CompletionCertificateResponse, MaterialResponse, RatingResponse } from '../services/api';
import ChatInbox from '../components/ChatInbox';

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const feedbackPopupHandledRef = useRef(false);
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mainTab, setMainTab] = useState<'sessions' | 'materials' | 'feedback' | 'messages'>('sessions');
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // New state for materials and feedback
  const [materials, setMaterials] = useState<MaterialResponse[]>([]);
  const [assignments, setAssignments] = useState<AssignmentResponse[]>([]);
  const [myRatings, setMyRatings] = useState<RatingResponse[]>([]);
  const [myCertificates, setMyCertificates] = useState<CompletionCertificateResponse[]>([]);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingForm, setRatingForm] = useState({
    tutor_id: '',
    tutor_name: '',
    subject: '',
    rating: 5,
    comment: ''
  });
  const [selectedBookingForRating, setSelectedBookingForRating] = useState<BookingResponse | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);

  // Handle tab query parameter from notifications
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['sessions', 'materials', 'feedback', 'messages'].includes(tabParam)) {
      setMainTab(tabParam as typeof mainTab);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchBookings();
    fetchMaterials();
    fetchAssignments();
    fetchMyRatings();
    fetchMyCertificates();
  }, []);

  // Auto-open feedback popup when redirected from meeting end.
  useEffect(() => {
    if (feedbackPopupHandledRef.current) return;

    const shouldOpenPopup = searchParams.get('feedback_popup') === '1';
    const bookingId = searchParams.get('booking_id');
    if (!shouldOpenPopup || !bookingId || bookings.length === 0) return;

    const booking = bookings.find(b => b.id === bookingId && b.status !== 'cancelled');
    if (!booking) return;

    setMainTab('feedback');
    setSelectedBookingForRating(booking);
    setRatingForm({
      tutor_id: booking.tutor_id || '',
      tutor_name: booking.tutor_name || 'Tutor',
      subject: booking.subject,
      rating: 5,
      comment: ''
    });
    setShowRatingModal(true);
    feedbackPopupHandledRef.current = true;

    // Clean up one-time trigger params.
    navigate('/student/dashboard?tab=feedback', { replace: true });
  }, [searchParams, bookings, navigate]);

  const fetchMaterials = async () => {
    try {
      const data = await materialsAPI.getMaterials();
      setMaterials(data);
    } catch (error) {
      console.error('Failed to fetch materials:', error);
    }
  };

  const fetchMyRatings = async () => {
    try {
      const data = await materialsAPI.getMyRatings();
      setMyRatings(data);
    } catch (error) {
      console.error('Failed to fetch ratings:', error);
    }
  };

  const fetchMyCertificates = async () => {
    try {
      const data = await materialsAPI.getMyCertificates();
      setMyCertificates(data);
    } catch (error) {
      console.error('Failed to fetch certificates:', error);
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

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const data = await bookingsAPI.getMyBookings();
      setBookings(data);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    setCancellingId(bookingId);
    try {
      const updated = await bookingsAPI.cancelBooking(bookingId);
      setBookings(prev => prev.map(b => b.id === bookingId ? updated : b));
      setMessage({ type: 'success', text: 'Booking cancelled successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to cancel booking' });
    } finally {
      setCancellingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: 'Copied to clipboard!' });
    setTimeout(() => setMessage(null), 2000);
  };

  const now = new Date();
  const upcomingBookings = bookings
    .filter(b => b.status !== 'cancelled' && new Date(b.scheduled_at) >= now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const pastBookings = bookings
    .filter(b => b.status === 'cancelled' || new Date(b.scheduled_at) < now)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pt-24 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.full_name?.split(' ')[0]}!
          </h1>
          <p className="text-gray-600 mt-2">Manage your tutoring sessions</p>
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

        {/* Main Navigation Tabs */}
        <div className="flex gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          {[
            { id: 'sessions', label: 'My Sessions', icon: Calendar },
            { id: 'materials', label: 'Study Materials', icon: BookOpen },
            { id: 'feedback', label: 'My Ratings', icon: Star },
            { id: 'messages', label: 'Messages', icon: MessageSquare },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id as typeof mainTab)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
                mainTab === tab.id
                  ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Sessions Tab Content */}
        {mainTab === 'sessions' && (
          <>
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{upcomingBookings.length}</div>
                <div className="text-sm text-gray-500">Upcoming</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-xl">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {bookings.filter(b => b.status === 'confirmed').length}
                </div>
                <div className="text-sm text-gray-500">Confirmed</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {bookings.filter(b => b.status === 'pending').length}
                </div>
                <div className="text-sm text-gray-500">Pending</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
              activeTab === 'upcoming'
                ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Upcoming Sessions ({upcomingBookings.length})
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
              activeTab === 'past'
                ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Past Sessions ({pastBookings.length})
          </button>
        </div>

        {/* Bookings List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {(activeTab === 'upcoming' ? upcomingBookings : pastBookings).length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 shadow-sm text-center">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No {activeTab} sessions
              </h3>
              <p className="text-gray-500">
                {activeTab === 'upcoming'
                  ? 'Book a session with a tutor to get started!'
                  : 'Your completed sessions will appear here.'}
              </p>
            </div>
          ) : (
            (activeTab === 'upcoming' ? upcomingBookings : pastBookings).map(booking => (
              <div
                key={booking.id}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                  booking.status === 'cancelled' ? 'border-red-200 opacity-75' :
                  booking.status === 'confirmed' ? 'border-green-200' :
                  'border-gray-100'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {booking.tutor_name || 'Tutor'}
                        </h3>
                        <p className="text-gray-600">{booking.subject}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                      booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                      booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      booking.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">
                        {new Date(booking.scheduled_at).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">
                        {new Date(booking.scheduled_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Video className="w-4 h-4" />
                      <span className="text-sm">{booking.session_type}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <DollarSign className="w-4 h-4" />
                      <span className="text-sm">{booking.currency === 'INR' ? '₹' : '$'}{booking.price.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Meet Link for confirmed bookings */}
                  {booking.status === 'confirmed' && booking.meeting_link && (
                    <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
                      <div className="flex items-center gap-2 text-sm font-medium text-green-700 mb-2">
                        <Video className="w-4 h-4" />
                        Your session is confirmed! Join in Zeal Catalyst:
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={booking.meeting_link}
                          readOnly
                          className="flex-1 px-3 py-2 text-sm bg-white border border-green-200 rounded-lg"
                        />
                        <button
                          onClick={() => copyToClipboard(booking.meeting_link!)}
                          className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                          title="Copy link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <a
                          href={booking.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Join Session
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Expired Meet link notice */}
                  {booking.status === 'confirmed' && !booking.meeting_link && booking.meeting_link_expired && (
                    <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
                      <div className="flex items-center gap-2 text-sm text-red-700">
                        <AlertCircle className="w-4 h-4" />
                        This session link has expired for safety.
                      </div>
                    </div>
                  )}

                  {/* Pending status notice */}
                  {booking.status === 'pending' && (
                    <div className="mt-4 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                      <div className="flex items-center gap-2 text-sm text-yellow-700">
                        <Clock className="w-4 h-4" />
                        Waiting for tutor confirmation. You'll receive a Meet link once confirmed.
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {booking.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <strong>Notes:</strong> {booking.notes}
                      </p>
                    </div>
                  )}

                  {/* Cancel button for upcoming bookings */}
                  {activeTab === 'upcoming' && booking.status !== 'cancelled' && (
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => handleCancelBooking(booking.id)}
                        disabled={cancellingId === booking.id}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {cancellingId === booking.id ? (
                          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                        Cancel Booking
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </motion.div>
          </>
        )}

        {/* Study Materials Tab */}
        {mainTab === 'materials' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Study Materials</h2>
              <p className="text-gray-600">Access reading materials shared by your tutors</p>
            </div>

            {materials.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 shadow-sm text-center">
                <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Materials Yet</h3>
                <p className="text-gray-500">Reading materials from your tutors will appear here</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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
                              <span className="text-xs text-gray-500">From: {material.tutor_name}</span>
                              <span className="text-xs text-gray-400">
                                {new Date(material.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        {material.file_url ? (
                          <a
                            href={material.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-xl hover:bg-primary-200 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </a>
                        ) : (
                          <span className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-400 rounded-xl cursor-not-allowed">
                            <Download className="w-4 h-4" />
                            No File
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Assignments</h3>
                <p className="text-sm text-gray-500 mt-1">Assignments shared by tutors you booked with</p>
              </div>
              {assignments.length === 0 ? (
                <div className="p-10 text-center">
                  <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No assignments yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {assignments.map(assignment => (
                    <div key={assignment.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-semibold text-gray-900">{assignment.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{assignment.description}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{assignment.subject}</span>
                            <span className="text-xs text-gray-500">From: {assignment.tutor_name}</span>
                            <span className="text-xs text-gray-500">Due: {new Date(assignment.due_date).toLocaleDateString()}</span>
                            <span className="text-xs text-gray-500">Max: {assignment.max_marks}</span>
                            {assignment.submission_date && (
                              <span className="text-xs text-green-600">Submitted: {new Date(assignment.submission_date).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {assignment.submission_url && (
                            <a
                              href={assignment.submission_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
                            >
                              View Submission
                            </a>
                          )}
                          {assignment.status === 'pending' && (
                            <button
                              onClick={async () => {
                                const submissionUrl = window.prompt('Paste submission link (Google Drive / Docs / PDF URL). You can leave empty.');
                                try {
                                  const updated = await materialsAPI.submitAssignment(assignment.id, submissionUrl || undefined);
                                  setAssignments(prev => prev.map(a => a.id === assignment.id ? updated : a));
                                  setMessage({ type: 'success', text: 'Assignment submitted successfully.' });
                                  setTimeout(() => setMessage(null), 2500);
                                } catch {
                                  setMessage({ type: 'error', text: 'Failed to submit assignment.' });
                                  setTimeout(() => setMessage(null), 3000);
                                }
                              }}
                              className="px-3 py-1 text-xs font-medium rounded-full bg-primary-600 text-white hover:bg-primary-700"
                            >
                              Submit
                            </button>
                          )}
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                            assignment.status === 'graded'
                              ? 'bg-green-100 text-green-700'
                              : assignment.status === 'submitted'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {assignment.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* My Ratings/Feedback Tab */}
        {mainTab === 'feedback' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">My Ratings & Feedback</h2>
                <p className="text-gray-600">Rate your tutors and view your past feedback</p>
              </div>
            </div>

            {/* Pending Ratings Section */}
            {pastBookings.filter(b => b.status === 'completed' || (b.status !== 'cancelled' && new Date(b.scheduled_at) < new Date())).length > 0 && (
              <div className="bg-yellow-50 rounded-2xl border border-yellow-200 p-6">
                <h3 className="font-semibold text-yellow-800 mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Rate Your Recent Sessions
                </h3>
                <div className="space-y-3">
                  {pastBookings
                    .filter(b => (b.status === 'completed' || (b.status !== 'cancelled' && new Date(b.scheduled_at) < new Date())) && !myRatings.find(r => r.session_date === b.scheduled_at))
                    .slice(0, 3)
                    .map(booking => (
                      <div key={booking.id} className="flex items-center justify-between bg-white p-4 rounded-xl">
                        <div>
                          <p className="font-medium text-gray-900">{booking.tutor_name || 'Tutor'}</p>
                          <p className="text-sm text-gray-600">{booking.subject} - {new Date(booking.scheduled_at).toLocaleDateString()}</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedBookingForRating(booking);
                            setRatingForm({
                              tutor_id: booking.tutor_id || '',
                              tutor_name: booking.tutor_name || 'Tutor',
                              subject: booking.subject,
                              rating: 5,
                              comment: ''
                            });
                            setShowRatingModal(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 transition-colors"
                        >
                          <Star className="w-4 h-4" />
                          Rate Now
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Rating Modal */}
            {showRatingModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-2xl p-6 w-full max-w-lg"
                >
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Rate Your Session</h3>
                  <div className="space-y-4">
                    <div className="text-center">
                      <p className="text-gray-600 mb-2">{ratingForm.tutor_name} - {ratingForm.subject}</p>
                      <div className="flex items-center justify-center gap-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            onClick={() => setRatingForm({ ...ratingForm, rating: star })}
                            className="transition-transform hover:scale-110"
                          >
                            <Star
                              className={`w-10 h-10 ${star <= ratingForm.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                            />
                          </button>
                        ))}
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        {ratingForm.rating === 5 ? 'Excellent!' :
                         ratingForm.rating === 4 ? 'Very Good' :
                         ratingForm.rating === 3 ? 'Good' :
                         ratingForm.rating === 2 ? 'Fair' : 'Poor'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Your Feedback</label>
                      <textarea
                        value={ratingForm.comment}
                        onChange={(e) => setRatingForm({ ...ratingForm, comment: e.target.value })}
                        placeholder="Share your experience with this tutor..."
                        rows={4}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setShowRatingModal(false);
                        setSelectedBookingForRating(null);
                      }}
                      className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setRatingLoading(true);
                        try {
                          const newRating = await materialsAPI.createRating({
                            tutor_id: ratingForm.tutor_id,
                            tutor_name: ratingForm.tutor_name,
                            booking_id: selectedBookingForRating?.id,
                            subject: ratingForm.subject,
                            rating: ratingForm.rating,
                            comment: ratingForm.comment,
                            session_date: selectedBookingForRating?.scheduled_at
                          });
                          setMyRatings([newRating, ...myRatings]);
                          await fetchMyCertificates();
                          setShowRatingModal(false);
                          setSelectedBookingForRating(null);
                          setMessage({
                            type: 'success',
                            text: newRating.certificate_url
                              ? 'Thank you for your feedback! Your certificate is ready to download.'
                              : 'Thank you for your feedback!'
                          });
                          setTimeout(() => setMessage(null), 3000);
                        } catch (error) {
                          console.error('Failed to submit rating:', error);
                          setMessage({ type: 'error', text: 'Failed to submit rating. Please try again.' });
                          setTimeout(() => setMessage(null), 3000);
                        } finally {
                          setRatingLoading(false);
                        }
                      }}
                      disabled={ratingLoading}
                      className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {ratingLoading ? 'Submitting...' : 'Submit Rating'}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* My Ratings List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Session Completion Certificates</h3>
              </div>
              {myCertificates.length === 0 ? (
                <div className="p-10 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No certificates yet. Submit feedback after completed sessions to receive certificates.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {myCertificates.map(certificate => (
                    <div key={certificate.id} className="p-6 flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-semibold text-gray-900">{certificate.subject}</h4>
                        {certificate.session_name && (
                          <p className="text-sm text-gray-600">Session: {certificate.session_name}</p>
                        )}
                        <p className="text-sm text-gray-600">Tutor: {certificate.tutor_name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Session: {new Date(certificate.session_date).toLocaleDateString()} | Certificate No: {certificate.certificate_number}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const updated = await materialsAPI.regenerateCertificate(certificate.id);
                              setMyCertificates(prev => prev.map(c => c.id === certificate.id ? updated : c));
                              setMessage({ type: 'success', text: 'Certificate redesigned. Download the new file now.' });
                              setTimeout(() => setMessage(null), 3000);
                            } catch (error) {
                              const detail = axios.isAxiosError(error)
                                ? (error.response?.data?.detail || error.message)
                                : 'Failed to regenerate certificate.';
                              setMessage({ type: 'error', text: typeof detail === 'string' ? detail : 'Failed to regenerate certificate.' });
                              setTimeout(() => setMessage(null), 3000);
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                        >
                          Refresh Design
                        </button>
                        <a
                          href={certificate.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-xl hover:bg-primary-200 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Your Past Ratings</h3>
              </div>
              {myRatings.length === 0 ? (
                <div className="p-12 text-center">
                  <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Ratings Yet</h3>
                  <p className="text-gray-500">Your ratings and feedback for tutors will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {myRatings.map(rating => (
                    <div key={rating.id} className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{rating.tutor_name}</h4>
                          <p className="text-sm text-gray-600">{rating.subject}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-5 h-5 ${i < rating.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-gray-700 mt-3">{rating.comment}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {rating.session_date && `Session: ${new Date(rating.session_date).toLocaleDateString()} | `}
                        Reviewed: {new Date(rating.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Messages Tab */}
        {mainTab === 'messages' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Messages</h2>
              <p className="text-gray-600">Chat with tutors and ask your doubts.</p>
            </div>
            <ChatInbox
              mode="student"
              initialTutorUserId={searchParams.get('tutor_user_id')}
              initialTutorProfileId={searchParams.get('tutor_profile_id')}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
