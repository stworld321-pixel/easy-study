import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, MapPin, Clock, CheckCircle } from 'lucide-react';
import type { TutorProfile } from '../../types';
import { tutorsAPI } from '../../services/api';

const TutorCard: React.FC<{ tutor: TutorProfile; index: number }> = ({ tutor, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5, delay: index * 0.1 }}
  >
    <Link to={`/tutors/${tutor.id}`} className="block">
      <div className="card p-6 h-full hover:scale-[1.02] transition-all duration-300">
        <div className="flex items-start space-x-4">
          {/* Avatar */}
          <div className="relative">
            <img
              src={tutor.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${tutor.full_name}`}
              alt={tutor.full_name}
              className="w-20 h-20 rounded-2xl object-cover"
            />
            {tutor.is_verified && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{tutor.full_name}</h3>
            <p className="text-sm text-gray-500 truncate">{tutor.headline}</p>

            {/* Rating */}
            <div className="flex items-center mt-2">
              <Star className="w-4 h-4 text-yellow-400 fill-current" />
              <span className="ml-1 text-sm font-medium text-gray-900">{tutor.rating.toFixed(1)}</span>
              <span className="ml-1 text-sm text-gray-500">({tutor.total_reviews} reviews)</span>
            </div>
          </div>
        </div>

        {/* Subjects */}
        <div className="mt-4 flex flex-wrap gap-2">
          {tutor.subjects.slice(0, 3).map((subject) => (
            <span
              key={subject}
              className="px-3 py-1 bg-primary-50 text-primary-700 text-xs font-medium rounded-full"
            >
              {subject}
            </span>
          ))}
          {tutor.subjects.length > 3 && (
            <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
              +{tutor.subjects.length - 3} more
            </span>
          )}
        </div>

        {/* Meta */}
        <div className="mt-4 flex items-center justify-between text-sm">
          <div className="flex items-center text-gray-500">
            <MapPin className="w-4 h-4 mr-1" />
            {tutor.country || 'Remote'}
          </div>
          <div className="flex items-center text-gray-500">
            <Clock className="w-4 h-4 mr-1" />
            {tutor.experience_years}+ years
          </div>
        </div>

        {/* Price */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold text-gray-900">${tutor.hourly_rate}</span>
            <span className="text-gray-500">/hour</span>
          </div>
          <button className="btn-primary text-sm py-2 px-4">
            Book Now
          </button>
        </div>
      </div>
    </Link>
  </motion.div>
);

const FeaturedTutors: React.FC = () => {
  const [tutors, setTutors] = useState<TutorProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTutors = async () => {
      try {
        const data = await tutorsAPI.getFeatured(6);
        setTutors(data);
      } catch (error) {
        // Use mock data if API fails
        setTutors([
          {
            id: '1',
            user_id: '1',
            full_name: 'Dr. Sarah Johnson',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
            headline: 'Expert Mathematics & Physics Tutor',
            bio: '',
            experience_years: 10,
            education: 'PhD in Applied Mathematics',
            certifications: [],
            hourly_rate: 75,
            currency: 'USD',
            languages: ['English', 'Spanish'],
            subjects: ['Mathematics', 'Physics', 'Calculus'],
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
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=James',
            headline: 'Full-Stack Developer & Programming Instructor',
            bio: '',
            experience_years: 8,
            education: 'MS in Computer Science',
            certifications: [],
            hourly_rate: 85,
            currency: 'USD',
            languages: ['English', 'Mandarin'],
            subjects: ['Computer Science', 'Web Development', 'Python'],
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
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emma',
            headline: 'IELTS & English Language Specialist',
            bio: '',
            experience_years: 6,
            education: 'MA in English Literature',
            certifications: [],
            hourly_rate: 55,
            currency: 'USD',
            languages: ['English', 'French'],
            subjects: ['English', 'IELTS', 'Academic Writing'],
            country: 'United Kingdom',
            city: 'London',
            offers_private: true,
            offers_group: true,
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
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Raj',
            headline: 'Chemistry & Biology Expert',
            bio: '',
            experience_years: 12,
            education: 'MD - Johns Hopkins University',
            certifications: [],
            hourly_rate: 90,
            currency: 'USD',
            languages: ['English', 'Hindi'],
            subjects: ['Chemistry', 'Biology', 'Medical Sciences'],
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
            is_available: true,
            created_at: '',
          },
          {
            id: '5',
            user_id: '5',
            full_name: 'Maria Garcia',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maria',
            headline: 'Data Science & ML Instructor',
            bio: '',
            experience_years: 5,
            education: 'MS in Data Science',
            certifications: [],
            hourly_rate: 80,
            currency: 'USD',
            languages: ['English', 'Spanish'],
            subjects: ['Data Science', 'Python', 'Machine Learning'],
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
          {
            id: '6',
            user_id: '6',
            full_name: 'Alex Kim',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
            headline: 'UI/UX Designer & Design Coach',
            bio: '',
            experience_years: 7,
            education: 'BFA in Graphic Design',
            certifications: [],
            hourly_rate: 70,
            currency: 'USD',
            languages: ['English', 'Korean'],
            subjects: ['UI/UX Design', 'Figma', 'Web Design'],
            country: 'South Korea',
            city: 'Seoul',
            offers_private: true,
            offers_group: true,
            total_students: 38,
            total_lessons: 150,
            rating: 4.9,
            total_reviews: 65,
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
  }, []);

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="section-title mb-4">
            Meet Our <span className="gradient-text">Top Tutors</span>
          </h2>
          <p className="section-subtitle mx-auto">
            Learn from the best - our featured tutors are highly rated experts in their fields
          </p>
        </motion.div>

        {/* Tutors Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card p-6 animate-pulse">
                <div className="flex items-start space-x-4">
                  <div className="w-20 h-20 bg-gray-200 rounded-2xl" />
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tutors.map((tutor, index) => (
              <TutorCard key={tutor.id} tutor={tutor} index={index} />
            ))}
          </div>
        )}

        {/* View All */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-12"
        >
          <Link to="/find-tutors" className="btn-primary">
            View All Tutors
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturedTutors;
