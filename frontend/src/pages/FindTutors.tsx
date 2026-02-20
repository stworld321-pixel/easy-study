import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Star, MapPin, Verified,
  X, SlidersHorizontal, GraduationCap, Users, Video,
  ChevronDown, Sparkles, BookOpen, Globe, Heart
} from 'lucide-react';
import type { TutorProfile } from '../types';
import { tutorsAPI } from '../services/api';
import BookingModal from '../components/BookingModal';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';

const subjects = [
  'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English',
  'Computer Science', 'Data Science', 'Web Development', 'Python',
  'Spanish', 'French', 'UI/UX Design'
];

const countries = [
  'United States', 'United Kingdom', 'Canada', 'India', 'Australia',
  'Germany', 'Spain', 'France', 'South Korea', 'Japan'
];

const languages = ['English', 'Spanish', 'French', 'German', 'Mandarin', 'Hindi', 'Korean'];

// Enhanced Tutor Card Component
const TutorCard: React.FC<{ tutor: TutorProfile; index: number; onBookTrial: (tutor: TutorProfile) => void }> = ({ tutor, index, onBookTrial }) => {
  const [isLiked, setIsLiked] = useState(false);
  const { formatPrice } = useCurrency();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group"
    >
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-2xl hover:shadow-primary-500/10 transition-all duration-500 hover:-translate-y-1">
        {/* Top Banner with Gradient */}
        <div className="h-2 bg-gradient-to-r from-primary-500 via-secondary-500 to-primary-500" />

        <div className="p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Avatar & Quick Stats */}
            <div className="flex flex-col items-center lg:items-start">
              {/* Avatar with Status */}
              <div className="relative">
                <div className="w-28 h-28 rounded-2xl overflow-hidden ring-4 ring-gray-100 group-hover:ring-primary-100 transition-all duration-300">
                  <img
                    src={tutor.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${tutor.full_name}`}
                    alt={tutor.full_name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {tutor.is_available && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 text-white text-xs font-medium rounded-full shadow-lg">
                    Available
                  </div>
                )}
                {tutor.is_verified && (
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                    <Verified className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="mt-6 grid grid-cols-2 gap-3 w-full">
                <div className="text-center p-2 bg-gray-50 rounded-xl">
                  <div className="text-lg font-bold text-gray-900">{tutor.total_students}</div>
                  <div className="text-xs text-gray-500">Students</div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-xl">
                  <div className="text-lg font-bold text-gray-900">{tutor.total_lessons}</div>
                  <div className="text-xs text-gray-500">Lessons</div>
                </div>
              </div>
            </div>

            {/* Middle: Main Info */}
            <div className="flex-1 text-center lg:text-left">
              {/* Name & Rating Row */}
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
                    {tutor.full_name}
                  </h3>
                  <p className="text-primary-600 font-medium text-sm mt-1">{tutor.headline}</p>
                </div>

                {/* Rating Badge */}
                <div className="flex items-center justify-center lg:justify-start gap-1 bg-yellow-50 px-3 py-1.5 rounded-full">
                  <Star className="w-5 h-5 text-yellow-500 fill-current" />
                  <span className="font-bold text-gray-900">{tutor.rating.toFixed(1)}</span>
                  <span className="text-gray-500 text-sm">({tutor.total_reviews})</span>
                </div>
              </div>

              {/* Bio */}
              <p className="text-gray-600 mt-3 line-clamp-2 leading-relaxed">{tutor.bio}</p>

              {/* Tags */}
              <div className="mt-4 flex flex-wrap justify-center lg:justify-start gap-2">
                {tutor.subjects.slice(0, 4).map((subject) => (
                  <span
                    key={subject}
                    className="px-3 py-1.5 bg-gradient-to-r from-primary-50 to-secondary-50 text-primary-700 text-sm font-medium rounded-lg border border-primary-100"
                  >
                    {subject}
                  </span>
                ))}
                {tutor.subjects.length > 4 && (
                  <span className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm font-medium rounded-lg">
                    +{tutor.subjects.length - 4} more
                  </span>
                )}
              </div>

              {/* Meta Info */}
              <div className="mt-4 flex flex-wrap justify-center lg:justify-start gap-4 text-sm">
                <div className="flex items-center text-gray-500">
                  <MapPin className="w-4 h-4 mr-1.5 text-gray-400" />
                  {tutor.country || 'Remote'}
                </div>
                <div className="flex items-center text-gray-500">
                  <GraduationCap className="w-4 h-4 mr-1.5 text-gray-400" />
                  {tutor.experience_years}+ years exp
                </div>
                <div className="flex items-center text-gray-500">
                  <Globe className="w-4 h-4 mr-1.5 text-gray-400" />
                  {tutor.languages?.slice(0, 2).join(', ')}
                </div>
              </div>

              {/* Session Types */}
              <div className="mt-4 flex justify-center lg:justify-start gap-2">
                {tutor.offers_private && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm">
                    <Video className="w-4 h-4" />
                    1-on-1 Sessions
                  </div>
                )}
                {tutor.offers_group && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm">
                    <Users className="w-4 h-4" />
                    Group Classes
                  </div>
                )}
              </div>
            </div>

            {/* Right: Price & Actions */}
            <div className="flex flex-col items-center lg:items-end justify-between lg:border-l border-gray-100 lg:pl-6 pt-4 lg:pt-0 border-t lg:border-t-0">
              {/* Like Button */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setIsLiked(!isLiked);
                }}
                className={`p-2 rounded-full transition-all duration-300 ${
                  isLiked ? 'bg-red-50 text-red-500' : 'bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500'
                }`}
              >
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              </button>

              {/* Price */}
              <div className="text-center my-4 space-y-2">
                {tutor.offers_private && (
                  <div>
                    <div className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                      {formatPrice(tutor.hourly_rate)}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                      <Video className="w-3 h-3" /> 1-on-1 /hr
                    </div>
                  </div>
                )}
                {tutor.offers_group && tutor.group_hourly_rate && (
                  <div className="pt-1 border-t border-gray-100">
                    <div className="text-lg font-bold text-secondary-600">
                      {formatPrice(tutor.group_hourly_rate)}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center justify-center gap-1">
                      <Users className="w-3 h-3" /> Group /hr
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 w-full lg:w-auto">
                <Link
                  to={`/tutors/${tutor.id}`}
                  className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all duration-300 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 text-center"
                >
                  View Profile
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onBookTrial(tutor);
                  }}
                  className="px-6 py-3 border-2 border-primary-200 text-primary-600 font-semibold rounded-xl hover:bg-primary-50 transition-all duration-300 text-center"
                >
                  Book Trial
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Filter Chip Component
const FilterChip: React.FC<{
  label: string;
  onRemove: () => void;
}> = ({ label, onRemove }) => (
  <motion.span
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.8 }}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-100 text-primary-700 rounded-full text-sm font-medium"
  >
    {label}
    <button onClick={onRemove} className="hover:bg-primary-200 rounded-full p-0.5 transition-colors">
      <X className="w-3.5 h-3.5" />
    </button>
  </motion.span>
);

const FindTutors: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tutors, setTutors] = useState<TutorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTutorForBooking, setSelectedTutorForBooking] = useState<TutorProfile | null>(null);

  // Handle book trial - check if user is logged in
  const handleBookTrial = (tutor: TutorProfile) => {
    if (!user) {
      // Redirect to login if not logged in
      navigate('/login', { state: { from: `/find-tutors`, message: 'Please login to book a trial session' } });
      return;
    }
    setSelectedTutorForBooking(tutor);
  };

  // Filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedSubject, setSelectedSubject] = useState(searchParams.get('subject') || '');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [sessionType, setSessionType] = useState<'all' | 'private' | 'group'>('all');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200]);
  const [sortBy, setSortBy] = useState('rating');

  useEffect(() => {
    const fetchTutors = async () => {
      setLoading(true);
      try {
        const params: Record<string, unknown> = {
          sort_by: sortBy,
        };
        if (selectedSubject) params.subject = selectedSubject;
        if (selectedCountry) params.country = selectedCountry;
        if (selectedLanguage) params.language = selectedLanguage;
        if (sessionType !== 'all') params.session_type = sessionType;
        if (priceRange[0] > 0) params.min_rate = priceRange[0];
        if (priceRange[1] < 200) params.max_rate = priceRange[1];

        const data = await tutorsAPI.getAll(params);
        setTutors(Array.isArray(data) ? data : []);
      } catch {
        // Mock data
        setTutors([
          {
            id: '1',
            user_id: '1',
            full_name: 'Dr. Sarah Johnson',
            avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
            headline: 'Expert Mathematics & Physics Tutor | PhD in Applied Mathematics',
            bio: 'With over 10 years of teaching experience, I specialize in making complex mathematical concepts accessible and engaging. My students consistently achieve top grades and develop a genuine love for problem-solving.',
            experience_years: 10,
            education: 'PhD in Applied Mathematics',
            certifications: [],
            hourly_rate: 75,
            currency: 'USD',
            languages: ['English', 'Spanish'],
            subjects: ['Mathematics', 'Physics', 'Calculus', 'Statistics'],
            country: 'United States',
            city: 'Boston',
            offers_private: true,
            offers_group: true,
            total_students: 89,
            total_lessons: 450,
            rating: 4.9,
            total_reviews: 156,
            is_verified: true,
            is_featured: true,
            is_available: true,
            created_at: '',
          },
          {
            id: '2',
            user_id: '2',
            full_name: 'James Chen',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
            headline: 'Full-Stack Developer & Programming Instructor',
            bio: 'Former Google engineer with a passion for teaching. I help students master programming from basics to advanced concepts with hands-on projects and real-world applications.',
            experience_years: 8,
            education: 'MS in Computer Science',
            certifications: [],
            hourly_rate: 85,
            currency: 'USD',
            languages: ['English', 'Mandarin'],
            subjects: ['Computer Science', 'Web Development', 'Python', 'JavaScript'],
            country: 'United States',
            city: 'San Francisco',
            offers_private: true,
            offers_group: true,
            total_students: 67,
            total_lessons: 380,
            rating: 4.8,
            total_reviews: 124,
            is_verified: true,
            is_featured: true,
            is_available: true,
            created_at: '',
          },
          {
            id: '3',
            user_id: '3',
            full_name: 'Emma Williams',
            avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop',
            headline: 'IELTS & English Language Specialist',
            bio: 'Native English speaker with expertise in IELTS preparation and academic writing. Helped hundreds of students achieve their target scores and gain admission to top universities.',
            experience_years: 6,
            education: 'MA in English Literature',
            certifications: [],
            hourly_rate: 55,
            currency: 'USD',
            languages: ['English', 'French'],
            subjects: ['English', 'IELTS', 'Academic Writing', 'Grammar'],
            country: 'United Kingdom',
            city: 'London',
            offers_private: true,
            offers_group: false,
            total_students: 145,
            total_lessons: 620,
            rating: 4.9,
            total_reviews: 203,
            is_verified: true,
            is_featured: true,
            is_available: true,
            created_at: '',
          },
          {
            id: '4',
            user_id: '4',
            full_name: 'Dr. Raj Patel',
            avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
            headline: 'Chemistry & Biology Expert | Medical Entrance Prep',
            bio: 'Medical doctor and experienced educator specializing in chemistry and biology for pre-med students. I make complex scientific concepts easy to understand.',
            experience_years: 12,
            education: 'MD - Johns Hopkins University',
            certifications: [],
            hourly_rate: 90,
            currency: 'USD',
            languages: ['English', 'Hindi'],
            subjects: ['Chemistry', 'Biology', 'Medical Sciences', 'Biochemistry'],
            country: 'India',
            city: 'Mumbai',
            offers_private: true,
            offers_group: true,
            total_students: 52,
            total_lessons: 280,
            rating: 4.7,
            total_reviews: 98,
            is_verified: true,
            is_featured: true,
            is_available: false,
            created_at: '',
          },
          {
            id: '5',
            user_id: '5',
            full_name: 'Maria Garcia',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
            headline: 'Data Science & Machine Learning Instructor',
            bio: 'Data scientist with experience at top tech companies. I teach practical data science skills with hands-on projects that prepare you for real-world challenges.',
            experience_years: 5,
            education: 'MS in Data Science',
            certifications: [],
            hourly_rate: 80,
            currency: 'USD',
            languages: ['English', 'Spanish'],
            subjects: ['Data Science', 'Python', 'Machine Learning', 'Statistics'],
            country: 'Spain',
            city: 'Barcelona',
            offers_private: true,
            offers_group: true,
            total_students: 43,
            total_lessons: 195,
            rating: 4.8,
            total_reviews: 87,
            is_verified: true,
            is_featured: true,
            is_available: true,
            created_at: '',
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchTutors();
  }, [selectedSubject, selectedCountry, selectedLanguage, sessionType, priceRange, sortBy]);

  const clearFilters = () => {
    setSelectedSubject('');
    setSelectedCountry('');
    setSelectedLanguage('');
    setSessionType('all');
    setPriceRange([0, 200]);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedSubject || selectedCountry || selectedLanguage || sessionType !== 'all' || priceRange[0] > 0 || priceRange[1] < 200;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Header */}
      <div className="relative pt-24 pb-16 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }} />
        </div>

        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary-500/20 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              Over 5,000+ Expert Tutors Available
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              Find Your Perfect
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-300">
                Tutor Today
              </span>
            </h1>

            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10">
              Connect with world-class tutors for personalized learning experiences that transform your potential
            </p>

            {/* Search Bar */}
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-2xl shadow-2xl p-2">
                <div className="flex flex-col md:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, subject, or keyword..."
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="relative md:w-48">
                    <BookOpen className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
                    >
                      <option value="">All Subjects</option>
                      {subjects.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                  <button className="px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all duration-300 shadow-lg shadow-primary-500/25">
                    Search
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <aside className={`lg:w-80 shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-28 shadow-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-primary-600" />
                  Filters
                </h3>
                {hasActiveFilters && (
                  <button onClick={clearFilters} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                    Clear all
                  </button>
                )}
              </div>

              {/* Session Type */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Session Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['all', 'private', 'group'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSessionType(type)}
                      className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                        sessionType === type
                          ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/25'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Country */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Country</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none cursor-pointer"
                  >
                    <option value="">All Countries</option>
                    {countries.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Language */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Language</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none cursor-pointer"
                  >
                    <option value="">All Languages</option>
                    {languages.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Price Range */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-gray-700">Price Range</label>
                  <span className="text-sm font-bold text-primary-600">${priceRange[0]} - ${priceRange[1]}</span>
                </div>
                <div className="px-2">
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>$0</span>
                    <span>$200+</span>
                  </div>
                </div>
              </div>

              {/* Verified Only */}
              <div className="p-4 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-xl border border-primary-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 rounded text-primary-600 focus:ring-primary-500" />
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-gray-900">
                      <Verified className="w-4 h-4 text-blue-500" />
                      Verified Tutors Only
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">Show only verified tutors</p>
                  </div>
                </label>
              </div>
            </motion.div>
          </aside>

          {/* Results */}
          <div className="flex-1">
            {/* Mobile Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden w-full mb-4 inline-flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              <SlidersHorizontal className="w-5 h-5" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>

            {/* Results Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {loading ? 'Finding tutors...' : `${tutors.length} Expert Tutors`}
                </h2>
                <p className="text-gray-500 text-sm mt-1">Matched to your learning needs</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Sort by:</span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="pl-4 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
                  >
                    <option value="rating">Highest Rated</option>
                    <option value="price_low">Price: Low to High</option>
                    <option value="price_high">Price: High to Low</option>
                    <option value="reviews">Most Reviews</option>
                    <option value="newest">Newest</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Active Filters */}
            <AnimatePresence>
              {hasActiveFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap gap-2 mb-6"
                >
                  {selectedSubject && (
                    <FilterChip label={selectedSubject} onRemove={() => setSelectedSubject('')} />
                  )}
                  {selectedCountry && (
                    <FilterChip label={selectedCountry} onRemove={() => setSelectedCountry('')} />
                  )}
                  {selectedLanguage && (
                    <FilterChip label={selectedLanguage} onRemove={() => setSelectedLanguage('')} />
                  )}
                  {sessionType !== 'all' && (
                    <FilterChip label={`${sessionType} sessions`} onRemove={() => setSessionType('all')} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tutors List */}
            {loading ? (
              <div className="space-y-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse">
                    <div className="flex gap-6">
                      <div className="w-28 h-28 bg-gray-200 rounded-2xl" />
                      <div className="flex-1">
                        <div className="h-6 bg-gray-200 rounded w-1/3 mb-3" />
                        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
                        <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : tutors.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-20 bg-white rounded-2xl border border-gray-100"
              >
                <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-secondary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="w-12 h-12 text-primary-500" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">No tutors found</h3>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">
                  We couldn't find any tutors matching your criteria. Try adjusting your filters.
                </p>
                <button onClick={clearFilters} className="px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all duration-300 shadow-lg shadow-primary-500/25">
                  Clear All Filters
                </button>
              </motion.div>
            ) : (
              <div className="space-y-6">
                {tutors.map((tutor, index) => (
                  <TutorCard
                    key={tutor.id}
                    tutor={tutor}
                    index={index}
                    onBookTrial={handleBookTrial}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {selectedTutorForBooking && (
        <BookingModal
          tutor={selectedTutorForBooking}
          onClose={() => setSelectedTutorForBooking(null)}
        />
      )}
    </div>
  );
};

export default FindTutors;
