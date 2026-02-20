import axios from 'axios';
import type { AuthResponse, TutorProfile, Subject, Review } from '../types';

// Use production URL if on production domain, otherwise use env variable or localhost.
const isProduction = typeof window !== 'undefined' && window.location.hostname === 'easystudy.cloud';
export const API_URL = isProduction
  ? 'https://easystudy.cloud/api'
  : (import.meta.env.VITE_API_URL || 'http://localhost:8000/api');
export const WS_URL = API_URL.replace('http://', 'ws://').replace('https://', 'wss://');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  register: async (data: {
    email: string;
    password: string;
    full_name: string;
    role: 'student' | 'tutor';
  }): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  googleAuth: async (credential: string, role?: string): Promise<AuthResponse> => {
    const response = await api.post('/auth/google', { credential, role });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Tutors API
export const tutorsAPI = {
  getAll: async (params?: {
    subject?: string;
    country?: string;
    min_rate?: number;
    max_rate?: number;
    session_type?: string;
    language?: string;
    sort_by?: string;
    skip?: number;
    limit?: number;
  }): Promise<TutorProfile[]> => {
    const response = await api.get('/tutors', { params });
    return response.data;
  },

  getFeatured: async (limit = 6): Promise<TutorProfile[]> => {
    const response = await api.get('/tutors/featured', { params: { limit } });
    return response.data;
  },

  getById: async (id: string): Promise<TutorProfile> => {
    const response = await api.get(`/tutors/${id}`);
    return response.data;
  },

  getReviews: async (tutorId: string): Promise<Review[]> => {
    const response = await api.get(`/tutors/${tutorId}/reviews`);
    return response.data;
  },

  getMyProfile: async (): Promise<TutorProfile> => {
    const response = await api.get('/tutors/profile/me');
    return response.data;
  },

  updateProfile: async (data: Partial<TutorProfile>): Promise<TutorProfile> => {
    const response = await api.put('/tutors/profile', data);
    return response.data;
  },
};

// Availability API
export interface TimeSlot {
  start_time: string;
  end_time: string;
}

export interface WeeklySchedule {
  monday: TimeSlot[];
  tuesday: TimeSlot[];
  wednesday: TimeSlot[];
  thursday: TimeSlot[];
  friday: TimeSlot[];
  saturday: TimeSlot[];
  sunday: TimeSlot[];
}

export interface AvailabilitySettings {
  id: string;
  tutor_id: string;
  timezone: string;
  session_duration: number;
  buffer_time: number;
  advance_booking_days: number;
  min_notice_hours: number;
  is_accepting_students: boolean;
  weekly_schedule: WeeklySchedule;
  created_at: string;
  updated_at: string;
}

export interface BlockedDate {
  id: string;
  tutor_id: string;
  date: string;
  reason?: string;
  created_at: string;
}

export interface CalendarDay {
  date: string;
  is_available: boolean;
  is_blocked: boolean;
  reason?: string;
  slots_count: number;
}

export interface MonthCalendar {
  year: number;
  month: number;
  days: CalendarDay[];
}

export const availabilityAPI = {
  getSettings: async (): Promise<AvailabilitySettings> => {
    const response = await api.get('/availability/settings');
    return response.data;
  },

  updateSettings: async (data: Partial<AvailabilitySettings>): Promise<AvailabilitySettings> => {
    const response = await api.put('/availability/settings', data);
    return response.data;
  },

  updateSchedule: async (schedule: WeeklySchedule): Promise<AvailabilitySettings> => {
    const response = await api.put('/availability/schedule', schedule);
    return response.data;
  },

  getBlockedDates: async (): Promise<{ blocked_dates: BlockedDate[]; total: number }> => {
    const response = await api.get('/availability/blocked-dates');
    return response.data;
  },

  addBlockedDate: async (date: string, reason?: string): Promise<BlockedDate> => {
    const response = await api.post('/availability/blocked-dates', { date, reason });
    return response.data;
  },

  removeBlockedDate: async (dateId: string): Promise<void> => {
    await api.delete(`/availability/blocked-dates/${dateId}`);
  },

  getCalendar: async (year: number, month: number): Promise<MonthCalendar> => {
    const response = await api.get(`/availability/calendar/${year}/${month}`);
    return response.data;
  },

  getPublicCalendar: async (tutorId: string, year: number, month: number): Promise<MonthCalendar> => {
    const response = await api.get(`/availability/public/${tutorId}/calendar/${year}/${month}`);
    return response.data;
  },
};

// Subjects API
export const subjectsAPI = {
  getAll: async (): Promise<Subject[]> => {
    const response = await api.get('/subjects');
    return response.data;
  },

  getCategories: async () => {
    const response = await api.get('/subjects/categories');
    return response.data;
  },
};

// Booking type for API responses
export interface BookingResponse {
  id: string;
  student_id: string;
  tutor_id: string;
  student_name?: string;
  tutor_name?: string;
  subject: string;
  session_type: 'private' | 'group';
  scheduled_at: string;
  duration_minutes: number;
  price: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  meeting_link?: string;
  created_at: string;
}

// Bookings API
export const bookingsAPI = {
  create: async (data: {
    tutor_id: string;
    subject: string;
    session_type: 'private' | 'group';
    scheduled_at: string;
    duration_minutes: number;
    notes?: string;
    currency?: string;
  }): Promise<BookingResponse> => {
    const response = await api.post('/bookings', data);
    return response.data;
  },

  getMyBookings: async (): Promise<BookingResponse[]> => {
    const response = await api.get('/bookings');
    return response.data;
  },

  getTutorBookings: async (): Promise<BookingResponse[]> => {
    const response = await api.get('/bookings/tutor/my-bookings');
    return response.data;
  },

  update: async (id: string, data: Partial<BookingResponse>): Promise<BookingResponse> => {
    const response = await api.put(`/bookings/${id}`, data);
    return response.data;
  },

  confirmBooking: async (id: string): Promise<BookingResponse> => {
    const response = await api.post(`/bookings/${id}/confirm`);
    return response.data;
  },

  cancelBooking: async (id: string): Promise<BookingResponse> => {
    const response = await api.post(`/bookings/${id}/cancel`);
    return response.data;
  },

  updateMeetLink: async (id: string, meetingLink: string): Promise<BookingResponse> => {
    const response = await api.put(`/bookings/${id}/meet-link`, { meeting_link: meetingLink });
    return response.data;
  },

  createReview: async (data: {
    tutor_id: string;
    booking_id?: string;
    rating: number;
    comment?: string;
  }): Promise<Review> => {
    const response = await api.post('/bookings/reviews', data);
    return response.data;
  },
};

// Payment API Types
export interface RazorpayOrder {
  success: boolean;
  order_id?: string;
  amount?: number;
  currency?: string;
  key_id?: string;
  payment_id?: string;
  error?: string;
}

export interface PaymentDetails {
  id: string;
  booking_id: string;
  session_amount: number;
  currency: string;
  admission_fee: number;
  commission_fee: number;
  total_platform_fee: number;
  tutor_earnings: number;
  status: string;
  is_first_booking: boolean;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  created_at: string;
}

// Payment API
export const paymentsAPI = {
  createOrder: async (bookingId: string): Promise<RazorpayOrder> => {
    const response = await api.post('/payments/create-order', { booking_id: bookingId });
    return response.data;
  },

  verifyPayment: async (data: {
    booking_id: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/payments/verify', data);
    return response.data;
  },

  getPaymentDetails: async (bookingId: string): Promise<PaymentDetails> => {
    const response = await api.get(`/payments/booking/${bookingId}`);
    return response.data;
  },

  getConfig: async (): Promise<{ key_id: string; currency: string; name: string }> => {
    const response = await api.get('/payments/config');
    return response.data;
  },
};

// Admin API Types
export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone?: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface AdminTutor {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  headline?: string;
  subjects: string[];
  hourly_rate: number;
  is_verified: boolean;
  is_active: boolean;
  total_sessions: number;
  rating: number;
  created_at: string;
}

export interface AdminBooking {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  tutor_id: string;
  tutor_name: string;
  tutor_email: string;
  subject: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  price: number;
  meeting_link?: string;
  created_at: string;
}

export interface DashboardStats {
  total_users: number;
  total_students: number;
  total_tutors: number;
  total_bookings: number;
  pending_bookings: number;
  confirmed_bookings: number;
  completed_bookings: number;
  cancelled_bookings: number;
  revenue_total: number;
  revenue_this_month: number;
  new_users_this_week: number;
  new_bookings_this_week: number;
}

export interface RevenueStats {
  total_revenue: number;
  total_admission_fees: number;
  total_commission_fees: number;
  total_tutor_payouts: number;
  total_payments: number;
  total_new_students: number;
  monthly_revenue: number;
  monthly_admission_fees: number;
  monthly_commission_fees: number;
  monthly_bookings: number;
  weekly_revenue: number;
  weekly_bookings: number;
  commission_rate: number;
  admission_rate: number;
}

export interface PaymentRecord {
  id: string;
  booking_id: string;
  student_id: string;
  student_name?: string;
  tutor_id: string;
  tutor_name?: string;
  session_amount: number;
  currency: string;
  admission_fee: number;
  commission_fee: number;
  total_platform_fee: number;
  tutor_earnings: number;
  status: string;
  is_first_booking: boolean;
  created_at: string;
  completed_at?: string;
}

export interface TutorEarnings {
  tutor_id: string;
  tutor_name: string;
  email: string;
  total_sessions: number;
  total_earnings: number;
  platform_fees_paid: number;
  pending_earnings: number;
}

// Admin API
export const adminAPI = {
  // Dashboard
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  // Users
  getUsers: async (params?: {
    role?: string;
    is_active?: boolean;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<AdminUser[]> => {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },

  getUser: async (id: string): Promise<AdminUser> => {
    const response = await api.get(`/admin/users/${id}`);
    return response.data;
  },

  updateUser: async (id: string, data: {
    full_name?: string;
    is_active?: boolean;
    is_verified?: boolean;
    role?: string;
  }): Promise<AdminUser> => {
    const response = await api.put(`/admin/users/${id}`, data);
    return response.data;
  },

  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/admin/users/${id}`);
  },

  // Tutors
  getTutors: async (params?: {
    is_verified?: boolean;
    is_active?: boolean;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<AdminTutor[]> => {
    const response = await api.get('/admin/tutors', { params });
    return response.data;
  },

  verifyTutor: async (id: string): Promise<void> => {
    await api.put(`/admin/tutors/${id}/verify`);
  },

  suspendTutor: async (id: string): Promise<void> => {
    await api.put(`/admin/tutors/${id}/suspend`);
  },

  activateTutor: async (id: string): Promise<void> => {
    await api.put(`/admin/tutors/${id}/activate`);
  },

  // Bookings
  getBookings: async (params?: {
    status?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<AdminBooking[]> => {
    const response = await api.get('/admin/bookings', { params });
    return response.data;
  },

  updateBookingStatus: async (id: string, status: string): Promise<void> => {
    await api.put(`/admin/bookings/${id}/status`, null, { params: { status } });
  },

  deleteBooking: async (id: string): Promise<void> => {
    await api.delete(`/admin/bookings/${id}`);
  },

  // Revenue
  getRevenueStats: async (): Promise<RevenueStats> => {
    const response = await api.get('/admin/revenue/stats');
    return response.data;
  },

  getPayments: async (params?: {
    status?: string;
    skip?: number;
    limit?: number;
  }): Promise<PaymentRecord[]> => {
    const response = await api.get('/admin/revenue/payments', { params });
    return response.data;
  },

  getPaymentBreakdown: async (id: string): Promise<unknown> => {
    const response = await api.get(`/admin/revenue/payments/${id}`);
    return response.data;
  },

  getTutorEarnings: async (): Promise<TutorEarnings[]> => {
    const response = await api.get('/admin/revenue/tutor-earnings');
    return response.data;
  },

  // Platform Settings
  getSettings: async (): Promise<{ minimum_withdrawal_amount: number }> => {
    const response = await api.get('/admin/settings');
    return response.data;
  },

  updateSettings: async (data: { minimum_withdrawal_amount?: number }): Promise<{ minimum_withdrawal_amount: number }> => {
    const response = await api.put('/admin/settings', data);
    return response.data;
  },
};

// Blog API Types
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featured_image?: string;
  category?: string;
  tags: string[];
  author_id: string;
  author_name?: string;
  author_avatar?: string;
  meta_title?: string;
  meta_description?: string;
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
  views: number;
  likes: number;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export interface BlogListItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  featured_image?: string;
  category?: string;
  tags: string[];
  author_name?: string;
  author_avatar?: string;
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
  views: number;
  likes: number;
  created_at: string;
  published_at?: string;
}

export interface BlogPaginated {
  blogs: BlogListItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface BlogCategory {
  name: string;
  count: number;
}

// Blog API
export const blogAPI = {
  // Public endpoints
  getPublicBlogs: async (params?: {
    page?: number;
    per_page?: number;
    category?: string;
    tag?: string;
    search?: string;
    featured?: boolean;
  }): Promise<BlogPaginated> => {
    const response = await api.get('/blogs/public', { params });
    return response.data;
  },

  getPublicBlogBySlug: async (slug: string): Promise<BlogPost> => {
    const response = await api.get(`/blogs/public/${slug}`);
    return response.data;
  },

  getCategories: async (): Promise<BlogCategory[]> => {
    const response = await api.get('/blogs/public/categories/list');
    return response.data;
  },

  getTags: async (): Promise<BlogCategory[]> => {
    const response = await api.get('/blogs/public/tags/list');
    return response.data;
  },

  likeBlog: async (slug: string): Promise<{ likes: number }> => {
    const response = await api.post(`/blogs/public/${slug}/like`);
    return response.data;
  },

  // Admin endpoints
  getAllBlogs: async (status?: string): Promise<BlogListItem[]> => {
    const response = await api.get('/blogs', { params: status ? { status } : {} });
    return response.data;
  },

  getBlogById: async (id: string): Promise<BlogPost> => {
    const response = await api.get(`/blogs/${id}`);
    return response.data;
  },

  createBlog: async (data: {
    title: string;
    excerpt?: string;
    content: string;
    featured_image?: string;
    category?: string;
    tags?: string[];
    meta_title?: string;
    meta_description?: string;
    status?: 'draft' | 'published' | 'archived';
    is_featured?: boolean;
  }): Promise<BlogPost> => {
    const response = await api.post('/blogs', data);
    return response.data;
  },

  updateBlog: async (id: string, data: {
    title?: string;
    excerpt?: string;
    content?: string;
    featured_image?: string;
    category?: string;
    tags?: string[];
    meta_title?: string;
    meta_description?: string;
    status?: 'draft' | 'published' | 'archived';
    is_featured?: boolean;
  }): Promise<BlogPost> => {
    const response = await api.put(`/blogs/${id}`, data);
    return response.data;
  },

  deleteBlog: async (id: string): Promise<void> => {
    await api.delete(`/blogs/${id}`);
  },

  publishBlog: async (id: string): Promise<BlogPost> => {
    const response = await api.post(`/blogs/${id}/publish`);
    return response.data;
  },

  unpublishBlog: async (id: string): Promise<BlogPost> => {
    const response = await api.post(`/blogs/${id}/unpublish`);
    return response.data;
  },
};

// Withdrawal API Types
export interface TutorStats {
  total_sessions: number;
  completed_sessions: number;
  pending_sessions: number;
  cancelled_sessions: number;
  total_earnings: number;
  available_balance: number;
  pending_withdrawals: number;
  withdrawn_amount: number;
  currency: string;
  monthly_sessions: number;
  monthly_earnings: number;
  minimum_withdrawal_amount: number;
}

export interface WithdrawalRequest {
  amount: number;
  payment_method: 'bank_transfer' | 'upi' | 'paypal';
  payment_details: string;
}

export interface WithdrawalResponse {
  id: string;
  tutor_id: string;
  tutor_name?: string;
  tutor_email?: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_details?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  admin_notes?: string;
  transaction_id?: string;
  created_at: string;
  processed_at?: string;
}

export interface WithdrawalStats {
  pending_count: number;
  pending_amount: number;
  approved_count: number;
  approved_amount: number;
  completed_count: number;
  completed_amount: number;
  rejected_count: number;
  rejected_amount: number;
  total_requests: number;
}

// Upload API Types
export interface UploadResponse {
  success: boolean;
  url: string;
  message: string;
}

export interface GoogleCalendarStatus {
  connected: boolean;
  email?: string;
}

// Upload API
export const uploadAPI = {
  uploadAvatar: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/uploads/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  uploadTutorImage: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/uploads/tutor-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  deleteAvatar: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete('/uploads/avatar');
    return response.data;
  },
};

// Withdrawal API
export const withdrawalAPI = {
  // Tutor endpoints
  getStats: async (): Promise<TutorStats> => {
    const response = await api.get('/withdrawals/stats');
    return response.data;
  },

  requestWithdrawal: async (data: WithdrawalRequest): Promise<WithdrawalResponse> => {
    const response = await api.post('/withdrawals', data);
    return response.data;
  },

  getMyWithdrawals: async (): Promise<WithdrawalResponse[]> => {
    const response = await api.get('/withdrawals/my-requests');
    return response.data;
  },

  // Admin endpoints
  getAllWithdrawals: async (status?: string): Promise<WithdrawalResponse[]> => {
    const response = await api.get('/withdrawals/admin/all', { params: status ? { status } : {} });
    return response.data;
  },

  getPendingCount: async (): Promise<{ pending_count: number }> => {
    const response = await api.get('/withdrawals/admin/pending-count');
    return response.data;
  },

  updateWithdrawal: async (id: string, data: {
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    admin_notes?: string;
    transaction_id?: string;
  }): Promise<WithdrawalResponse> => {
    const response = await api.put(`/withdrawals/admin/${id}`, data);
    return response.data;
  },

  getWithdrawalStats: async (): Promise<WithdrawalStats> => {
    const response = await api.get('/withdrawals/admin/stats');
    return response.data;
  },
};

// Google Calendar API
export const googleCalendarAPI = {
  getStatus: async (): Promise<GoogleCalendarStatus> => {
    const response = await api.get('/google-calendar/status');
    return response.data;
  },

  connect: async (frontendRedirect: string): Promise<{ auth_url: string }> => {
    const response = await api.get('/google-calendar/connect', {
      params: { frontend_redirect: frontendRedirect },
    });
    return response.data;
  },

  disconnect: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete('/google-calendar/disconnect');
    return response.data;
  },
};

// Materials API Types
export interface MaterialResponse {
  id: string;
  tutor_id: string;
  tutor_name: string;
  title: string;
  description: string;
  subject: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  created_at: string;
}

export interface AssignmentResponse {
  id: string;
  tutor_id: string;
  tutor_name: string;
  title: string;
  description: string;
  subject: string;
  due_date: string;
  max_marks: number;
  student_id?: string;
  student_name?: string;
  status: string;
  obtained_marks?: number;
  feedback?: string;
  created_at: string;
}

export interface RatingResponse {
  id: string;
  tutor_id: string;
  tutor_name: string;
  student_id: string;
  student_name: string;
  subject: string;
  rating: number;
  comment: string;
  session_date?: string;
  created_at: string;
}

// Booked Student type
export interface BookedStudent {
  id: string;
  name: string;
  email: string;
}

// Materials & Learning API
export const materialsAPI = {
  // Get students who booked with this tutor
  getBookedStudents: async (): Promise<BookedStudent[]> => {
    const response = await api.get('/materials/students');
    return response.data;
  },

  // Materials
  createMaterial: async (data: FormData): Promise<MaterialResponse> => {
    const response = await api.post('/materials', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getMaterials: async (): Promise<MaterialResponse[]> => {
    const response = await api.get('/materials');
    return response.data;
  },

  deleteMaterial: async (id: string): Promise<void> => {
    await api.delete(`/materials/${id}`);
  },

  // Assignments
  createAssignment: async (data: {
    title: string;
    description: string;
    subject: string;
    due_date: string;
    max_marks: number;
  }): Promise<AssignmentResponse> => {
    const response = await api.post('/assignments', data);
    return response.data;
  },

  getAssignments: async (): Promise<AssignmentResponse[]> => {
    const response = await api.get('/assignments');
    return response.data;
  },

  deleteAssignment: async (id: string): Promise<void> => {
    await api.delete(`/assignments/${id}`);
  },

  // Ratings
  createRating: async (data: {
    tutor_id: string;
    tutor_name: string;
    booking_id?: string;
    subject: string;
    rating: number;
    comment: string;
    session_date?: string;
  }): Promise<RatingResponse> => {
    const response = await api.post('/ratings', data);
    return response.data;
  },

  getMyRatings: async (): Promise<RatingResponse[]> => {
    const response = await api.get('/ratings/my');
    return response.data;
  },

  getTutorRatings: async (tutorId: string): Promise<RatingResponse[]> => {
    const response = await api.get(`/ratings/tutor/${tutorId}`);
    return response.data;
  },
};

export default api;
