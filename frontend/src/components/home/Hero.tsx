import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';
import { Search, Play, Star, Users, BookOpen, Award } from 'lucide-react';
import CountUp from '../ui/CountUp';

const Hero: React.FC = () => {
  const [teacherAnimation, setTeacherAnimation] = useState(null);

  useEffect(() => {
    fetch('/animations/Teacher.json')
      .then(response => response.json())
      .then(data => setTeacherAnimation(data))
      .catch(err => console.error('Failed to load animation:', err));
  }, []);
  return (
    <section className="relative min-h-screen pt-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-secondary-50" />
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-bl from-primary-100/50 to-transparent" />

      {/* Floating Elements */}
      <div className="absolute top-40 left-10 w-20 h-20 bg-primary-200 rounded-full blur-3xl opacity-60 animate-float" />
      <div className="absolute bottom-40 right-20 w-32 h-32 bg-secondary-200 rounded-full blur-3xl opacity-60 animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute top-60 right-40 w-16 h-16 bg-yellow-200 rounded-full blur-2xl opacity-60 animate-float" style={{ animationDelay: '4s' }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            <div className="inline-flex items-center px-4 py-2 bg-primary-100 rounded-full text-primary-700 text-sm font-medium mb-6">
              <Star className="w-4 h-4 mr-2 fill-current" />
              Rated 4.9/5 by 10,000+ students
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
              Learn From
              <span className="block gradient-text">Expert Tutors</span>
              Worldwide
            </h1>

            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0">
              Connect with qualified tutors for personalized learning experiences.
              Flexible scheduling, expert instruction, and results that matter.
            </p>

            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="What do you want to learn?"
                  className="w-full pl-12 pr-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-lg"
                />
              </div>
              <Link to="/find-tutors" className="btn-primary px-8 whitespace-nowrap">
                Find Tutors
              </Link>
            </div>

            {/* Stats with Animated Numbers */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-8">
              <motion.div
                className="flex items-center space-x-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    <CountUp end={50} duration={2000} suffix="K+" />
                  </div>
                  <div className="text-sm text-gray-500">Active Students</div>
                </div>
              </motion.div>
              <motion.div
                className="flex items-center space-x-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <div className="w-12 h-12 bg-secondary-100 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-secondary-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    <CountUp end={5} duration={2000} suffix="K+" />
                  </div>
                  <div className="text-sm text-gray-500">Expert Tutors</div>
                </div>
              </motion.div>
              <motion.div
                className="flex items-center space-x-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
              >
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Award className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    <CountUp end={100} duration={2000} suffix="+" />
                  </div>
                  <div className="text-sm text-gray-500">Subjects</div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Hero Animation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative">
              {/* Main Lottie Animation */}
              <div className="relative z-10">
                {teacherAnimation ? (
                  <Lottie
                    animationData={teacherAnimation}
                    loop={true}
                    className="w-full h-auto max-w-lg mx-auto"
                  />
                ) : (
                  <div className="w-full max-w-lg mx-auto h-96 bg-gradient-to-br from-primary-100 to-secondary-100 rounded-3xl animate-pulse" />
                )}
              </div>

              {/* Floating Card 1 */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="absolute -left-4 lg:-left-8 top-1/4 glass-card p-4 shadow-xl"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                    <Play className="w-5 h-5 text-white ml-1" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Live Sessions</div>
                    <div className="text-sm text-gray-500">1-on-1 tutoring</div>
                  </div>
                </div>
              </motion.div>

              {/* Floating Card 2 */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="absolute -right-4 bottom-1/4 glass-card p-4 shadow-xl"
              >
                <div className="flex items-center space-x-2 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 text-yellow-400 fill-current" />
                  ))}
                </div>
                <div className="text-sm text-gray-600">"Best learning experience!"</div>
                <div className="text-xs text-gray-400 mt-1">- Sarah M.</div>
              </motion.div>

              {/* Background Decoration */}
              <div className="absolute -z-10 -right-8 -bottom-8 w-full h-full bg-gradient-to-br from-primary-200 to-secondary-200 rounded-3xl opacity-50" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
