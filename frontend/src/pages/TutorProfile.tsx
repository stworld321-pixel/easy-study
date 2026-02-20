import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Star, MapPin, Verified, GraduationCap, Users, Video,
  Globe, Calendar, Clock, BookOpen, Award, MessageCircle,
  Heart, Share2
} from 'lucide-react';
import { tutorsAPI } from '../services/api';
import type { TutorProfile as TutorProfileType } from '../types';
import BookingModal from '../components/BookingModal';
import { useCurrency } from '../context/CurrencyContext';

const TutorProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [tutor, setTutor] = useState<TutorProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    const fetchTutor = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await tutorsAPI.getById(id);
        setTutor(data);
      } catch (error) {
        console.error('Failed to fetch tutor:', error);
        // Mock data for testing
        setTutor({
          id: id,
          user_id: id,
          full_name: 'Dr. Sarah Johnson',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
          headline: 'Expert Mathematics & Physics Tutor | PhD in Applied Mathematics',
          bio: 'With over 10 years of teaching experience, I specialize in making complex mathematical concepts accessible and engaging. My students consistently achieve top grades and develop a genuine love for problem-solving. I believe every student can excel with the right guidance and personalized approach.',
          experience_years: 10,
          education: 'PhD in Applied Mathematics - MIT',
          certifications: ['Certified Math Educator', 'Advanced Physics Teaching'],
          hourly_rate: 75,
          group_hourly_rate: 45,
          currency: 'INR',
          languages: ['English', 'Spanish'],
          teaching_style: 'I use a combination of visual aids, real-world examples, and interactive problem-solving to make learning engaging and effective.',
          subjects: ['Mathematics', 'Physics', 'Calculus', 'Statistics', 'Algebra'],
          country: 'United States',
          city: 'Boston',
          timezone: 'America/New_York',
          offers_private: true,
          offers_group: true,
          total_students: 89,
          total_lessons: 450,
          rating: 4.9,
          total_reviews: 156,
          is_verified: true,
          is_featured: true,
          is_available: true,
          created_at: '2023-01-15',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTutor();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!tutor) {
    return (
      <div className="min-h-screen bg-gray-50 pt-24 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Tutor not found</h2>
          <Link to="/find-tutors" className="text-primary-600 hover:underline">
            Browse all tutors
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }} />
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-10 pb-16">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-2xl overflow-hidden ring-4 ring-white shadow-lg">
                        <img
                          src={tutor.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${tutor.full_name}`}
                          alt={tutor.full_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {tutor.is_verified && (
                        <div className="absolute -top-2 -right-2 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                          <Verified className="w-5 h-5 text-white" />
                        </div>
                      )}
                      {tutor.is_available && (
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-green-500 text-white text-xs font-medium rounded-full shadow-lg">
                          Available
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div>
                        <h1 className="text-2xl font-bold text-gray-900">{tutor.full_name}</h1>
                        <p className="text-primary-600 font-medium mt-1">{tutor.headline}</p>
                      </div>
                      <div className="flex items-center justify-center md:justify-start gap-2">
                        <button
                          onClick={() => setIsLiked(!isLiked)}
                          className={`p-2.5 rounded-xl transition-all ${
                            isLiked ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500'
                          }`}
                        >
                          <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                        </button>
                        <button className="p-2.5 bg-gray-100 text-gray-400 rounded-xl hover:bg-gray-200 transition-all">
                          <Share2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
                      <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1.5 rounded-full">
                        <Star className="w-5 h-5 text-yellow-500 fill-current" />
                        <span className="font-bold text-gray-900">{tutor.rating.toFixed(1)}</span>
                        <span className="text-gray-500 text-sm">({tutor.total_reviews} reviews)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <MapPin className="w-4 h-4" />
                        {tutor.city}, {tutor.country}
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Clock className="w-4 h-4" />
                        {tutor.timezone || 'UTC'}
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-4 mt-6">
                      <div className="text-center p-3 bg-gray-50 rounded-xl">
                        <div className="text-2xl font-bold text-gray-900">{tutor.total_students}</div>
                        <div className="text-xs text-gray-500">Students</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-xl">
                        <div className="text-2xl font-bold text-gray-900">{tutor.total_lessons}</div>
                        <div className="text-xs text-gray-500">Lessons</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-xl">
                        <div className="text-2xl font-bold text-gray-900">{tutor.experience_years}+</div>
                        <div className="text-xs text-gray-500">Years Exp</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* About Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary-600" />
                About Me
              </h2>
              <p className="text-gray-600 leading-relaxed">{tutor.bio}</p>

              {tutor.teaching_style && (
                <div className="mt-6 p-4 bg-primary-50 rounded-xl border border-primary-100">
                  <h3 className="font-semibold text-primary-900 mb-2">Teaching Style</h3>
                  <p className="text-primary-700 text-sm">{tutor.teaching_style}</p>
                </div>
              )}
            </motion.div>

            {/* Subjects */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary-600" />
                Subjects I Teach
              </h2>
              <div className="flex flex-wrap gap-2">
                {tutor.subjects.map((subject) => (
                  <span
                    key={subject}
                    className="px-4 py-2 bg-gradient-to-r from-primary-50 to-secondary-50 text-primary-700 font-medium rounded-xl border border-primary-100"
                  >
                    {subject}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Education & Credentials */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-primary-600" />
                Education & Credentials
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{tutor.education}</h3>
                    <p className="text-sm text-gray-500">Education</p>
                  </div>
                </div>
                {tutor.certifications && tutor.certifications.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-secondary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Award className="w-5 h-5 text-secondary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Certifications</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {tutor.certifications.map((cert, idx) => (
                          <span key={idx} className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-lg">
                            {cert}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Languages */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"
            >
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary-600" />
                Languages
              </h2>
              <div className="flex flex-wrap gap-3">
                {tutor.languages.map((lang) => (
                  <div key={lang} className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl">
                    <span className="font-medium text-gray-900">{lang}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Column - Booking Card */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-xl p-6 sticky top-28"
            >
              {/* Pricing */}
              <div className="mb-6 space-y-3">
                {tutor.offers_private && (
                  <div className="text-center p-4 bg-primary-50 rounded-xl border border-primary-100">
                    <div className="flex items-center justify-center gap-2 text-sm text-primary-600 font-medium mb-1">
                      <Video className="w-4 h-4" />
                      1-on-1 Session
                    </div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                      {formatPrice(tutor.hourly_rate)}
                    </div>
                    <div className="text-gray-500 text-sm">per hour</div>
                  </div>
                )}
                {tutor.offers_group && tutor.group_hourly_rate && (
                  <div className="text-center p-4 bg-secondary-50 rounded-xl border border-secondary-100">
                    <div className="flex items-center justify-center gap-2 text-sm text-secondary-600 font-medium mb-1">
                      <Users className="w-4 h-4" />
                      Group Session
                    </div>
                    <div className="text-2xl font-bold text-secondary-600">
                      {formatPrice(tutor.group_hourly_rate)}
                    </div>
                    <div className="text-gray-500 text-sm">per hour</div>
                  </div>
                )}
              </div>

              {/* Session Types */}
              <div className="space-y-3 mb-6">
                {tutor.offers_private && (
                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <Video className="w-5 h-5 text-emerald-600" />
                    <div>
                      <div className="font-medium text-emerald-900">1-on-1 Sessions</div>
                      <div className="text-xs text-emerald-600">Private tutoring available</div>
                    </div>
                  </div>
                )}
                {tutor.offers_group && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                    <Users className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="font-medium text-blue-900">Group Classes</div>
                      <div className="text-xs text-blue-600">Learn with others</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Book Button */}
              <button
                onClick={() => setShowBookingModal(true)}
                className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all duration-300 shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2"
              >
                <Calendar className="w-5 h-5" />
                Book a Trial Lesson
              </button>

              <button className="w-full mt-3 py-4 border-2 border-primary-200 text-primary-600 font-semibold rounded-xl hover:bg-primary-50 transition-all duration-300 flex items-center justify-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Send Message
              </button>

              {/* Response Time */}
              <div className="mt-6 text-center text-sm text-gray-500">
                <Clock className="w-4 h-4 inline mr-1" />
                Usually responds within 2 hours
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {showBookingModal && tutor && (
        <BookingModal
          tutor={tutor}
          onClose={() => setShowBookingModal(false)}
        />
      )}
    </div>
  );
};

export default TutorProfile;
