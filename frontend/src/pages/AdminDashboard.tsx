import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, GraduationCap, Briefcase, Calendar,
  DollarSign, TrendingUp, Search, Filter,
  Check, X, AlertCircle, Trash2, Eye, Ban,
  CheckCircle, Clock, UserCheck, BarChart3,
  Wallet, UserPlus, Percent, ArrowUpRight,
  FileText, Plus, Edit3, Send, Archive, Star,
  ArrowDownCircle, Building, Smartphone, CreditCard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { adminAPI, blogAPI, withdrawalAPI } from '../services/api';
import type { DashboardStats, AdminUser, AdminTutor, AdminBooking, RevenueStats, PaymentRecord, BlogListItem, BlogPost, WithdrawalResponse, WithdrawalStats } from '../services/api';

type TabType = 'overview' | 'users' | 'tutors' | 'bookings' | 'revenue' | 'blogs' | 'withdrawals';

interface BlogFormData {
  title: string;
  excerpt: string;
  content: string;
  featured_image: string;
  category: string;
  tags: string[];
  meta_title: string;
  meta_description: string;
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
}

const emptyBlogForm: BlogFormData = {
  title: '',
  excerpt: '',
  content: '',
  featured_image: '',
  category: '',
  tags: [],
  meta_title: '',
  meta_description: '',
  status: 'draft',
  is_featured: false
};

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Data states
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tutors, setTutors] = useState<AdminTutor[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [blogs, setBlogs] = useState<BlogListItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalResponse[]>([]);
  const [withdrawalStats, setWithdrawalStats] = useState<WithdrawalStats | null>(null);

  // Filter states
  const [userFilter, setUserFilter] = useState({ role: '', search: '' });
  const [tutorFilter, setTutorFilter] = useState({ verified: '', search: '' });
  const [bookingFilter, setBookingFilter] = useState({ status: '', search: '' });
  const [blogFilter, setBlogFilter] = useState({ status: '', search: '' });
  const [withdrawalFilter, setWithdrawalFilter] = useState({ status: '', search: '' });

  // Withdrawal update states
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalResponse | null>(null);
  const [withdrawalNotes, setWithdrawalNotes] = useState('');
  const [withdrawalTxnId, setWithdrawalTxnId] = useState('');

  // Platform settings
  const [minWithdrawalAmount, setMinWithdrawalAmount] = useState(10);
  const [minWithdrawalInput, setMinWithdrawalInput] = useState('10');
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Blog editor states
  const [showBlogEditor, setShowBlogEditor] = useState(false);
  const [editingBlogId, setEditingBlogId] = useState<string | null>(null);
  const [blogForm, setBlogForm] = useState<BlogFormData>(emptyBlogForm);
  const [tagInput, setTagInput] = useState('');

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, usersData, tutorsData, bookingsData, revenueData, paymentsData, blogsData, withdrawalsData, withdrawalStatsData, settingsData] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getUsers(),
        adminAPI.getTutors(),
        adminAPI.getBookings(),
        adminAPI.getRevenueStats(),
        adminAPI.getPayments(),
        blogAPI.getAllBlogs(),
        withdrawalAPI.getAllWithdrawals(),
        withdrawalAPI.getWithdrawalStats(),
        adminAPI.getSettings().catch(() => ({ minimum_withdrawal_amount: 10 }))
      ]);
      setStats(statsData);
      setUsers(usersData);
      setTutors(tutorsData);
      setBookings(bookingsData);
      setRevenueStats(revenueData);
      setPayments(paymentsData);
      setBlogs(blogsData);
      setWithdrawals(withdrawalsData);
      setWithdrawalStats(withdrawalStatsData);
      setMinWithdrawalAmount(settingsData.minimum_withdrawal_amount);
      setMinWithdrawalInput(String(settingsData.minimum_withdrawal_amount));
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      setMessage({ type: 'error', text: 'Failed to load admin data' });
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // User Actions
  const handleToggleUserActive = async (userId: string, currentActive: boolean) => {
    setActionLoading(userId);
    try {
      await adminAPI.updateUser(userId, { is_active: !currentActive });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentActive } : u));
      showMessage('success', `User ${currentActive ? 'deactivated' : 'activated'} successfully`);
    } catch {
      showMessage('error', 'Failed to update user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    setActionLoading(userId);
    try {
      await adminAPI.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      showMessage('success', 'User deleted successfully');
    } catch {
      showMessage('error', 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  // Tutor Actions
  const handleVerifyTutor = async (tutorId: string) => {
    setActionLoading(tutorId);
    try {
      await adminAPI.verifyTutor(tutorId);
      setTutors(prev => prev.map(t => t.id === tutorId ? { ...t, is_verified: true } : t));
      showMessage('success', 'Tutor verified successfully');
    } catch {
      showMessage('error', 'Failed to verify tutor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleTutorActive = async (tutorId: string, currentActive: boolean) => {
    setActionLoading(tutorId);
    try {
      if (currentActive) {
        await adminAPI.suspendTutor(tutorId);
      } else {
        await adminAPI.activateTutor(tutorId);
      }
      setTutors(prev => prev.map(t => t.id === tutorId ? { ...t, is_active: !currentActive } : t));
      showMessage('success', `Tutor ${currentActive ? 'suspended' : 'activated'} successfully`);
    } catch {
      showMessage('error', 'Failed to update tutor');
    } finally {
      setActionLoading(null);
    }
  };

  // Booking Actions
  const handleUpdateBookingStatus = async (bookingId: string, status: string) => {
    setActionLoading(bookingId);
    try {
      await adminAPI.updateBookingStatus(bookingId, status);
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
      showMessage('success', `Booking status updated to ${status}`);
    } catch {
      showMessage('error', 'Failed to update booking');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) return;
    setActionLoading(bookingId);
    try {
      await adminAPI.deleteBooking(bookingId);
      setBookings(prev => prev.filter(b => b.id !== bookingId));
      showMessage('success', 'Booking deleted successfully');
    } catch {
      showMessage('error', 'Failed to delete booking');
    } finally {
      setActionLoading(null);
    }
  };

  // Blog Actions
  const handleOpenBlogEditor = (blog?: BlogListItem) => {
    if (blog) {
      setEditingBlogId(blog.id);
      // Fetch full blog data for editing
      blogAPI.getBlogById(blog.id).then((fullBlog: BlogPost) => {
        setBlogForm({
          title: fullBlog.title,
          excerpt: fullBlog.excerpt || '',
          content: fullBlog.content,
          featured_image: fullBlog.featured_image || '',
          category: fullBlog.category || '',
          tags: fullBlog.tags || [],
          meta_title: fullBlog.meta_title || '',
          meta_description: fullBlog.meta_description || '',
          status: fullBlog.status,
          is_featured: fullBlog.is_featured
        });
      });
    } else {
      setEditingBlogId(null);
      setBlogForm(emptyBlogForm);
    }
    setShowBlogEditor(true);
  };

  const handleCloseBlogEditor = () => {
    setShowBlogEditor(false);
    setEditingBlogId(null);
    setBlogForm(emptyBlogForm);
    setTagInput('');
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !blogForm.tags.includes(tagInput.trim())) {
      setBlogForm(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setBlogForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const handleSaveBlog = async (publish = false) => {
    if (!blogForm.title.trim() || !blogForm.content.trim()) {
      showMessage('error', 'Title and content are required');
      return;
    }

    setActionLoading('save-blog');
    try {
      const data = {
        ...blogForm,
        status: publish ? 'published' as const : blogForm.status
      };

      if (editingBlogId) {
        await blogAPI.updateBlog(editingBlogId, data);
        showMessage('success', 'Blog updated successfully');
      } else {
        await blogAPI.createBlog(data);
        showMessage('success', 'Blog created successfully');
      }

      // Refresh blogs
      const blogsData = await blogAPI.getAllBlogs();
      setBlogs(blogsData);
      handleCloseBlogEditor();
    } catch {
      showMessage('error', 'Failed to save blog');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublishBlog = async (blogId: string) => {
    setActionLoading(blogId);
    try {
      await blogAPI.publishBlog(blogId);
      setBlogs(prev => prev.map(b => b.id === blogId ? { ...b, status: 'published' as const } : b));
      showMessage('success', 'Blog published successfully');
    } catch {
      showMessage('error', 'Failed to publish blog');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpublishBlog = async (blogId: string) => {
    setActionLoading(blogId);
    try {
      await blogAPI.unpublishBlog(blogId);
      setBlogs(prev => prev.map(b => b.id === blogId ? { ...b, status: 'draft' as const } : b));
      showMessage('success', 'Blog unpublished successfully');
    } catch {
      showMessage('error', 'Failed to unpublish blog');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteBlog = async (blogId: string) => {
    if (!confirm('Are you sure you want to delete this blog post?')) return;
    setActionLoading(blogId);
    try {
      await blogAPI.deleteBlog(blogId);
      setBlogs(prev => prev.filter(b => b.id !== blogId));
      showMessage('success', 'Blog deleted successfully');
    } catch {
      showMessage('error', 'Failed to delete blog');
    } finally {
      setActionLoading(null);
    }
  };

  // Withdrawal Actions
  const handleUpdateWithdrawal = async (withdrawalId: string, status: 'approved' | 'rejected' | 'completed') => {
    setActionLoading(withdrawalId);
    try {
      await withdrawalAPI.updateWithdrawal(withdrawalId, {
        status,
        admin_notes: withdrawalNotes || undefined,
        transaction_id: withdrawalTxnId || undefined
      });

      // Refresh data
      const [withdrawalsData, withdrawalStatsData] = await Promise.all([
        withdrawalAPI.getAllWithdrawals(),
        withdrawalAPI.getWithdrawalStats()
      ]);
      setWithdrawals(withdrawalsData);
      setWithdrawalStats(withdrawalStatsData);
      setSelectedWithdrawal(null);
      setWithdrawalNotes('');
      setWithdrawalTxnId('');
      showMessage('success', `Withdrawal ${status} successfully`);
    } catch {
      showMessage('error', 'Failed to update withdrawal');
    } finally {
      setActionLoading(null);
    }
  };

  // Save minimum withdrawal setting
  const handleSaveMinWithdrawal = async () => {
    const amount = parseFloat(minWithdrawalInput);
    if (isNaN(amount) || amount < 0) {
      showMessage('error', 'Please enter a valid amount');
      return;
    }
    setSettingsSaving(true);
    try {
      const result = await adminAPI.updateSettings({ minimum_withdrawal_amount: amount });
      setMinWithdrawalAmount(result.minimum_withdrawal_amount);
      showMessage('success', `Minimum withdrawal amount updated to ${amount}`);
    } catch {
      showMessage('error', 'Failed to update settings');
    } finally {
      setSettingsSaving(false);
    }
  };

  // Filtered data
  const filteredUsers = users.filter(u => {
    if (userFilter.role && u.role !== userFilter.role) return false;
    if (userFilter.search) {
      const search = userFilter.search.toLowerCase();
      if (!u.full_name.toLowerCase().includes(search) && !u.email.toLowerCase().includes(search)) return false;
    }
    return true;
  });

  const filteredTutors = tutors.filter(t => {
    if (tutorFilter.verified === 'verified' && !t.is_verified) return false;
    if (tutorFilter.verified === 'pending' && t.is_verified) return false;
    if (tutorFilter.search) {
      const search = tutorFilter.search.toLowerCase();
      if (!t.full_name.toLowerCase().includes(search) && !t.email.toLowerCase().includes(search)) return false;
    }
    return true;
  });

  const filteredBookings = bookings.filter(b => {
    if (bookingFilter.status && b.status !== bookingFilter.status) return false;
    if (bookingFilter.search) {
      const search = bookingFilter.search.toLowerCase();
      if (!b.student_name.toLowerCase().includes(search) && !b.tutor_name.toLowerCase().includes(search)) return false;
    }
    return true;
  });

  const filteredBlogs = blogs.filter(b => {
    if (blogFilter.status && b.status !== blogFilter.status) return false;
    if (blogFilter.search) {
      const search = blogFilter.search.toLowerCase();
      if (!b.title.toLowerCase().includes(search) && !(b.category?.toLowerCase().includes(search))) return false;
    }
    return true;
  });

  const filteredWithdrawals = withdrawals.filter(w => {
    if (withdrawalFilter.status && w.status !== withdrawalFilter.status) return false;
    if (withdrawalFilter.search) {
      const search = withdrawalFilter.search.toLowerCase();
      if (!w.tutor_name?.toLowerCase().includes(search) && !w.tutor_email?.toLowerCase().includes(search)) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage users, tutors, and bookings</p>
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

        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-white p-2 rounded-2xl shadow-sm overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'tutors', label: 'Tutors', icon: GraduationCap },
            { id: 'bookings', label: 'Bookings', icon: Calendar },
            { id: 'revenue', label: 'Revenue', icon: Wallet },
            { id: 'withdrawals', label: 'Withdrawals', icon: ArrowDownCircle },
            { id: 'blogs', label: 'Blogs', icon: FileText },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.total_users}</div>
                    <div className="text-sm text-gray-500">Total Users</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <GraduationCap className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.total_students}</div>
                    <div className="text-sm text-gray-500">Students</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-100 rounded-xl">
                    <Briefcase className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.total_tutors}</div>
                    <div className="text-sm text-gray-500">Tutors</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-xl">
                    <Calendar className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.total_bookings}</div>
                    <div className="text-sm text-gray-500">Total Bookings</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Revenue & Bookings Stats */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Revenue
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">Total Revenue</span>
                    <span className="text-2xl font-bold text-green-600">₹{stats.revenue_total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">This Month</span>
                    <span className="text-xl font-bold text-green-600">₹{stats.revenue_this_month.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  This Week
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">New Users</span>
                    <span className="text-2xl font-bold text-blue-600">{stats.new_users_this_week}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">New Bookings</span>
                    <span className="text-xl font-bold text-blue-600">{stats.new_bookings_this_week}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Booking Status Breakdown */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Booking Status Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-yellow-50 rounded-xl text-center">
                  <Clock className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-yellow-700">{stats.pending_bookings}</div>
                  <div className="text-sm text-yellow-600">Pending</div>
                </div>
                <div className="p-4 bg-green-50 rounded-xl text-center">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-700">{stats.confirmed_bookings}</div>
                  <div className="text-sm text-green-600">Confirmed</div>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl text-center">
                  <Check className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-700">{stats.completed_bookings}</div>
                  <div className="text-sm text-blue-600">Completed</div>
                </div>
                <div className="p-4 bg-red-50 rounded-xl text-center">
                  <X className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-red-700">{stats.cancelled_bookings}</div>
                  <div className="text-sm text-red-600">Cancelled</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Filters */}
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-6 flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userFilter.search}
                  onChange={(e) => setUserFilter({ ...userFilter, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={userFilter.role}
                  onChange={(e) => setUserFilter({ ...userFilter, role: e.target.value })}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Roles</option>
                  <option value="student">Students</option>
                  <option value="tutor">Tutors</option>
                  <option value="admin">Admins</option>
                </select>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">User</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Role</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Joined</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{u.full_name}</div>
                          <div className="text-sm text-gray-500">{u.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          u.role === 'tutor' ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleToggleUserActive(u.id, u.is_active)}
                            disabled={actionLoading === u.id}
                            className={`p-2 rounded-lg transition-colors ${
                              u.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={u.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {u.is_active ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            disabled={actionLoading === u.id}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="p-12 text-center text-gray-500">No users found</div>
              )}
            </div>
          </motion.div>
        )}

        {/* Tutors Tab */}
        {activeTab === 'tutors' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Filters */}
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-6 flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tutors..."
                  value={tutorFilter.search}
                  onChange={(e) => setTutorFilter({ ...tutorFilter, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={tutorFilter.verified}
                  onChange={(e) => setTutorFilter({ ...tutorFilter, verified: e.target.value })}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Tutors</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending Verification</option>
                </select>
              </div>
            </div>

            {/* Tutors Table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Tutor</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Subjects</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Rate</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Sessions</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTutors.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{t.full_name}</div>
                          <div className="text-sm text-gray-500">{t.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {t.subjects.slice(0, 2).map(s => (
                            <span key={s} className="px-2 py-1 text-xs bg-gray-100 rounded-full">{s}</span>
                          ))}
                          {t.subjects.length > 2 && (
                            <span className="px-2 py-1 text-xs bg-gray-100 rounded-full">+{t.subjects.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">${t.hourly_rate}/hr</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full inline-block w-fit ${
                            t.is_verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {t.is_verified ? 'Verified' : 'Pending'}
                          </span>
                          <span className={`px-3 py-1 text-xs font-medium rounded-full inline-block w-fit ${
                            t.is_active ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {t.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{t.total_sessions}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          {!t.is_verified && (
                            <button
                              onClick={() => handleVerifyTutor(t.id)}
                              disabled={actionLoading === t.id}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Verify"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleTutorActive(t.id, t.is_active)}
                            disabled={actionLoading === t.id}
                            className={`p-2 rounded-lg transition-colors ${
                              t.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={t.is_active ? 'Suspend' : 'Activate'}
                          >
                            {t.is_active ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTutors.length === 0 && (
                <div className="p-12 text-center text-gray-500">No tutors found</div>
              )}
            </div>
          </motion.div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Filters */}
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-6 flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by student or tutor..."
                  value={bookingFilter.search}
                  onChange={(e) => setBookingFilter({ ...bookingFilter, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={bookingFilter.status}
                  onChange={(e) => setBookingFilter({ ...bookingFilter, status: e.target.value })}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Bookings Table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Student</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Tutor</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Subject</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Date</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Price</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBookings.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{b.student_name}</div>
                          <div className="text-sm text-gray-500">{b.student_email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{b.tutor_name}</div>
                          <div className="text-sm text-gray-500">{b.tutor_email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{b.subject}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(b.scheduled_at).toLocaleDateString()}<br />
                        {new Date(b.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4 font-medium">₹{b.price.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <select
                          value={b.status}
                          onChange={(e) => handleUpdateBookingStatus(b.id, e.target.value)}
                          disabled={actionLoading === b.id}
                          className={`px-3 py-1 text-xs font-medium rounded-full border-0 cursor-pointer ${
                            b.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                            b.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            b.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                            'bg-red-100 text-red-700'
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          {b.meeting_link && (
                            <a
                              href={b.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View Meet"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteBooking(b.id)}
                            disabled={actionLoading === b.id}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredBookings.length === 0 && (
                <div className="p-12 text-center text-gray-500">No bookings found</div>
              )}
            </div>
          </motion.div>
        )}

        {/* Revenue Tab */}
        {activeTab === 'revenue' && revenueStats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Platform Fee Info */}
            <div className="bg-gradient-to-r from-primary-600 to-secondary-600 rounded-2xl p-6 text-white">
              <h3 className="text-xl font-bold mb-4">Platform Fee Structure</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Percent className="w-6 h-6" />
                    <span className="font-semibold">Session Commission</span>
                  </div>
                  <div className="text-3xl font-bold">{revenueStats.commission_rate}%</div>
                  <p className="text-white/70 text-sm mt-1">Applied to every session booking</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <UserPlus className="w-6 h-6" />
                    <span className="font-semibold">Admission Fee</span>
                  </div>
                  <div className="text-3xl font-bold">{revenueStats.admission_rate}%</div>
                  <p className="text-white/70 text-sm mt-1">One-time fee for new students</p>
                </div>
              </div>
            </div>

            {/* Revenue Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-xl">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">₹{revenueStats.total_revenue.toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Total Platform Revenue</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Percent className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">₹{revenueStats.total_commission_fees.toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Commission Fees (5%)</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <UserPlus className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">₹{revenueStats.total_admission_fees.toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Admission Fees (10%)</div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-100 rounded-xl">
                    <ArrowUpRight className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">₹{revenueStats.total_tutor_payouts.toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Tutor Payouts</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Monthly & Weekly Stats */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary-600" />
                  This Month
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">Revenue</span>
                    <span className="text-xl font-bold text-green-600">₹{revenueStats.monthly_revenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">Commission</span>
                    <span className="font-bold text-blue-600">₹{revenueStats.monthly_commission_fees.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">Admission</span>
                    <span className="font-bold text-purple-600">₹{revenueStats.monthly_admission_fees.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">Bookings</span>
                    <span className="font-bold text-gray-900">{revenueStats.monthly_bookings}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  Summary
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">Total Payments</span>
                    <span className="text-xl font-bold text-gray-900">{revenueStats.total_payments}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">New Students</span>
                    <span className="font-bold text-purple-600">{revenueStats.total_new_students}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">Weekly Revenue</span>
                    <span className="font-bold text-green-600">₹{revenueStats.weekly_revenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                    <span className="text-gray-600">Weekly Bookings</span>
                    <span className="font-bold text-gray-900">{revenueStats.weekly_bookings}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Payments Table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">Recent Payments</h3>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Student</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Tutor</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Session</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Commission</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Admission</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Platform Fee</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.slice(0, 10).map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{p.student_name}</div>
                        {p.is_first_booking && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">New</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{p.tutor_name}</td>
                      <td className="px-6 py-4 font-medium">₹{p.session_amount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-blue-600">₹{p.commission_fee.toFixed(2)}</td>
                      <td className="px-6 py-4 text-purple-600">
                        {p.admission_fee > 0 ? `₹${p.admission_fee.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-6 py-4 font-bold text-green-600">₹{p.total_platform_fee.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          p.status === 'completed' ? 'bg-green-100 text-green-700' :
                          p.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payments.length === 0 && (
                <div className="p-12 text-center text-gray-500">No payments yet</div>
              )}
            </div>
          </motion.div>
        )}

        {/* Withdrawals Tab */}
        {activeTab === 'withdrawals' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Withdrawal Stats */}
            {withdrawalStats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold text-yellow-700">{withdrawalStats.pending_count}</div>
                      <div className="text-sm text-yellow-600">Pending</div>
                    </div>
                    <Clock className="w-8 h-8 text-yellow-500" />
                  </div>
                  <div className="mt-2 text-sm text-yellow-700 font-medium">
                    ₹{withdrawalStats.pending_amount.toFixed(2)}
                  </div>
                </div>

                <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold text-blue-700">{withdrawalStats.approved_count}</div>
                      <div className="text-sm text-blue-600">Approved</div>
                    </div>
                    <CheckCircle className="w-8 h-8 text-blue-500" />
                  </div>
                  <div className="mt-2 text-sm text-blue-700 font-medium">
                    ₹{withdrawalStats.approved_amount.toFixed(2)}
                  </div>
                </div>

                <div className="bg-green-50 rounded-2xl p-6 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold text-green-700">{withdrawalStats.completed_count}</div>
                      <div className="text-sm text-green-600">Completed</div>
                    </div>
                    <Check className="w-8 h-8 text-green-500" />
                  </div>
                  <div className="mt-2 text-sm text-green-700 font-medium">
                    ₹{withdrawalStats.completed_amount.toFixed(2)}
                  </div>
                </div>

                <div className="bg-red-50 rounded-2xl p-6 border border-red-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-bold text-red-700">{withdrawalStats.rejected_count}</div>
                      <div className="text-sm text-red-600">Rejected</div>
                    </div>
                    <X className="w-8 h-8 text-red-500" />
                  </div>
                  <div className="mt-2 text-sm text-red-700 font-medium">
                    ₹{withdrawalStats.rejected_amount.toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {/* Minimum Withdrawal Setting */}
            <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Withdrawal Settings</h3>
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Minimum Withdrawal Amount</label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-medium">₹</span>
                    <input
                      type="number"
                      value={minWithdrawalInput}
                      onChange={(e) => setMinWithdrawalInput(e.target.value)}
                      min="0"
                      step="1"
                      className="w-32 px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                      onClick={handleSaveMinWithdrawal}
                      disabled={settingsSaving || parseFloat(minWithdrawalInput) === minWithdrawalAmount}
                      className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {settingsSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Tutors must earn at least this amount before they can request a withdrawal</p>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1 max-w-md relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by tutor name or email..."
                  value={withdrawalFilter.search}
                  onChange={(e) => setWithdrawalFilter({ ...withdrawalFilter, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                />
              </div>
              <select
                value={withdrawalFilter.status}
                onChange={(e) => setWithdrawalFilter({ ...withdrawalFilter, status: e.target.value })}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Withdrawal Update Modal */}
            <AnimatePresence>
              {selectedWithdrawal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                  onClick={() => setSelectedWithdrawal(null)}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-lg"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="p-6 border-b border-gray-100">
                      <h2 className="text-xl font-bold text-gray-900">Process Withdrawal</h2>
                    </div>

                    <div className="p-6 space-y-4">
                      {/* Withdrawal Details */}
                      <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tutor</span>
                          <span className="font-medium">{selectedWithdrawal.tutor_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Email</span>
                          <span className="text-sm">{selectedWithdrawal.tutor_email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Amount</span>
                          <span className="font-bold text-lg text-green-600">
                            {selectedWithdrawal.currency} {selectedWithdrawal.amount.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Method</span>
                          <span className="capitalize">{selectedWithdrawal.payment_method.replace('_', ' ')}</span>
                        </div>
                        <div className="pt-2 border-t border-gray-200">
                          <span className="text-gray-600 text-sm">Payment Details:</span>
                          <p className="text-sm mt-1 whitespace-pre-wrap">{selectedWithdrawal.payment_details}</p>
                        </div>
                      </div>

                      {/* Admin Notes */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes</label>
                        <textarea
                          value={withdrawalNotes}
                          onChange={(e) => setWithdrawalNotes(e.target.value)}
                          placeholder="Add notes (optional)..."
                          rows={2}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>

                      {/* Transaction ID (for completion) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Transaction ID</label>
                        <input
                          type="text"
                          value={withdrawalTxnId}
                          onChange={(e) => setWithdrawalTxnId(e.target.value)}
                          placeholder="Enter transaction reference..."
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>

                    <div className="p-6 border-t border-gray-100 flex gap-3">
                      <button
                        onClick={() => setSelectedWithdrawal(null)}
                        className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      {selectedWithdrawal.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleUpdateWithdrawal(selectedWithdrawal.id, 'rejected')}
                            disabled={actionLoading === selectedWithdrawal.id}
                            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleUpdateWithdrawal(selectedWithdrawal.id, 'approved')}
                            disabled={actionLoading === selectedWithdrawal.id}
                            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                        </>
                      )}
                      {selectedWithdrawal.status === 'approved' && (
                        <button
                          onClick={() => handleUpdateWithdrawal(selectedWithdrawal.id, 'completed')}
                          disabled={actionLoading === selectedWithdrawal.id}
                          className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
                        >
                          Mark as Completed
                        </button>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Withdrawals Table */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Date</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Tutor</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Amount</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Method</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredWithdrawals.map(w => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(w.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{w.tutor_name}</div>
                        <div className="text-sm text-gray-500">{w.tutor_email}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {w.currency} {w.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {w.payment_method === 'bank_transfer' && <Building className="w-4 h-4 text-gray-500" />}
                          {w.payment_method === 'upi' && <Smartphone className="w-4 h-4 text-gray-500" />}
                          {w.payment_method === 'paypal' && <CreditCard className="w-4 h-4 text-gray-500" />}
                          <span className="capitalize">{w.payment_method.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          w.status === 'completed' ? 'bg-green-100 text-green-700' :
                          w.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                          w.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedWithdrawal(w);
                            setWithdrawalNotes(w.admin_notes || '');
                            setWithdrawalTxnId(w.transaction_id || '');
                          }}
                          className="px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors font-medium text-sm"
                        >
                          {w.status === 'pending' ? 'Process' : w.status === 'approved' ? 'Complete' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredWithdrawals.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <ArrowDownCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  No withdrawal requests found
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Blogs Tab */}
        {activeTab === 'blogs' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Blog Editor Modal */}
            <AnimatePresence>
              {showBlogEditor && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
                  onClick={handleCloseBlogEditor}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                      <h2 className="text-xl font-bold text-gray-900">
                        {editingBlogId ? 'Edit Blog Post' : 'Create New Blog Post'}
                      </h2>
                      <button
                        onClick={handleCloseBlogEditor}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* Title */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                        <input
                          type="text"
                          value={blogForm.title}
                          onChange={(e) => setBlogForm({ ...blogForm, title: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="Enter blog title..."
                        />
                      </div>

                      {/* Excerpt */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Excerpt</label>
                        <textarea
                          value={blogForm.excerpt}
                          onChange={(e) => setBlogForm({ ...blogForm, excerpt: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                          rows={2}
                          placeholder="Short summary for listings..."
                          maxLength={500}
                        />
                        <p className="text-xs text-gray-500 mt-1">{blogForm.excerpt.length}/500 characters</p>
                      </div>

                      {/* Content */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Content * (Markdown supported)</label>
                        <textarea
                          value={blogForm.content}
                          onChange={(e) => setBlogForm({ ...blogForm, content: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono text-sm"
                          rows={12}
                          placeholder="Write your blog content here... You can use Markdown for formatting."
                        />
                      </div>

                      {/* Featured Image */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Featured Image URL</label>
                        <input
                          type="url"
                          value={blogForm.featured_image}
                          onChange={(e) => setBlogForm({ ...blogForm, featured_image: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="https://example.com/image.jpg"
                        />
                      </div>

                      {/* Category and Tags */}
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                          <input
                            type="text"
                            value={blogForm.category}
                            onChange={(e) => setBlogForm({ ...blogForm, category: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="e.g., Education, Tips, News"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={tagInput}
                              onChange={(e) => setTagInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="Add tag and press Enter"
                            />
                            <button
                              type="button"
                              onClick={handleAddTag}
                              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                          {blogForm.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {blogForm.tags.map(tag => (
                                <span
                                  key={tag}
                                  className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm flex items-center gap-1"
                                >
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTag(tag)}
                                    className="hover:text-primary-900"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* SEO */}
                      <div className="p-4 bg-gray-50 rounded-xl space-y-4">
                        <h3 className="font-medium text-gray-900">SEO Settings</h3>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Meta Title</label>
                          <input
                            type="text"
                            value={blogForm.meta_title}
                            onChange={(e) => setBlogForm({ ...blogForm, meta_title: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="SEO title (max 60 chars)"
                            maxLength={60}
                          />
                          <p className="text-xs text-gray-500 mt-1">{blogForm.meta_title.length}/60 characters</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Meta Description</label>
                          <textarea
                            value={blogForm.meta_description}
                            onChange={(e) => setBlogForm({ ...blogForm, meta_description: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                            rows={2}
                            placeholder="SEO description (max 160 chars)"
                            maxLength={160}
                          />
                          <p className="text-xs text-gray-500 mt-1">{blogForm.meta_description.length}/160 characters</p>
                        </div>
                      </div>

                      {/* Options */}
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={blogForm.is_featured}
                            onChange={(e) => setBlogForm({ ...blogForm, is_featured: e.target.checked })}
                            className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm font-medium text-gray-700">Featured Post</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-gray-700">Status:</label>
                          <select
                            value={blogForm.status}
                            onChange={(e) => setBlogForm({ ...blogForm, status: e.target.value as 'draft' | 'published' | 'archived' })}
                            className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="archived">Archived</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-6 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0 bg-white">
                      <button
                        onClick={handleCloseBlogEditor}
                        className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveBlog(false)}
                        disabled={actionLoading === 'save-blog'}
                        className="px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-colors flex items-center gap-2"
                      >
                        <Archive className="w-4 h-4" />
                        Save as Draft
                      </button>
                      <button
                        onClick={() => handleSaveBlog(true)}
                        disabled={actionLoading === 'save-blog'}
                        className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl hover:from-primary-700 hover:to-primary-600 transition-colors flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        {editingBlogId ? 'Update & Publish' : 'Publish'}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header with Create Button */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex-1 flex gap-4">
                <div className="flex-1 max-w-md relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search blogs..."
                    value={blogFilter.search}
                    onChange={(e) => setBlogFilter({ ...blogFilter, search: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  />
                </div>
                <select
                  value={blogFilter.status}
                  onChange={(e) => setBlogFilter({ ...blogFilter, status: e.target.value })}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <button
                onClick={() => handleOpenBlogEditor()}
                className="ml-4 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl hover:from-primary-700 hover:to-primary-600 transition-colors flex items-center gap-2 shadow-lg"
              >
                <Plus className="w-5 h-5" />
                New Blog Post
              </button>
            </div>

            {/* Blogs Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBlogs.map(blog => (
                <motion.div
                  key={blog.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden group"
                >
                  {/* Featured Image */}
                  <div className="aspect-video bg-gray-100 relative overflow-hidden">
                    {blog.featured_image ? (
                      <img
                        src={blog.featured_image}
                        alt={blog.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-12 h-12 text-gray-300" />
                      </div>
                    )}
                    {blog.is_featured && (
                      <div className="absolute top-3 left-3 px-3 py-1 bg-yellow-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Featured
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        blog.status === 'published' ? 'bg-green-100 text-green-700' :
                        blog.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {blog.status}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-5">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                      {blog.category && (
                        <span className="px-2 py-1 bg-primary-50 text-primary-600 rounded-full text-xs">
                          {blog.category}
                        </span>
                      )}
                      <span>{new Date(blog.created_at).toLocaleDateString()}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">{blog.title}</h3>
                    {blog.excerpt && (
                      <p className="text-gray-600 text-sm line-clamp-2 mb-3">{blog.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Eye className="w-4 h-4" />
                          {blog.views}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-4 h-4" />
                          {blog.likes}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenBlogEditor(blog)}
                        disabled={actionLoading === blog.id}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {blog.status === 'published' ? (
                        <button
                          onClick={() => handleUnpublishBlog(blog.id)}
                          disabled={actionLoading === blog.id}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                          title="Unpublish"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePublishBlog(blog.id)}
                          disabled={actionLoading === blog.id}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Publish"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteBlog(blog.id)}
                        disabled={actionLoading === blog.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {blog.status === 'published' && (
                      <a
                        href={`/blog/${blog.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        View Post
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {filteredBlogs.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No blog posts yet</h3>
                <p className="text-gray-500 mb-6">Create your first blog post to get started</p>
                <button
                  onClick={() => handleOpenBlogEditor()}
                  className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl hover:from-primary-700 hover:to-primary-600 transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Create Blog Post
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
