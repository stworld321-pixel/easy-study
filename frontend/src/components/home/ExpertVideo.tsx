import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';
import { Play, Award, Star, BookOpen } from 'lucide-react';

const ExpertVideo: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [teacherAnimation, setTeacherAnimation] = useState<object | null>(null);

  useEffect(() => {
    fetch('/animations/Teacher.json')
      .then(response => response.json())
      .then(data => setTeacherAnimation(data))
      .catch(() => {});
  }, []);

  const handlePlayVideo = () => {
    setIsPlaying(true);
  };

  return (
    <section className="py-24 bg-gradient-to-br from-primary-50 via-white to-secondary-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Side - Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center px-4 py-2 bg-primary-100 text-primary-700 rounded-full text-sm font-medium mb-6">
              <Award className="w-4 h-4 mr-2" />
              Meet Our Experts
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              Learn from{' '}
              <span className="gradient-text">World-Class</span>{' '}
              Subject Experts
            </h2>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Our platform connects you with experienced educators who are passionate
              about teaching. Watch how our experts deliver engaging, personalized
              lessons that make learning enjoyable and effective.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="text-center p-4 bg-white rounded-xl shadow-sm">
                <div className="text-3xl font-bold gradient-text">500+</div>
                <div className="text-sm text-gray-600">Expert Tutors</div>
              </div>
              <div className="text-center p-4 bg-white rounded-xl shadow-sm">
                <div className="text-3xl font-bold gradient-text">50+</div>
                <div className="text-sm text-gray-600">Subjects</div>
              </div>
              <div className="text-center p-4 bg-white rounded-xl shadow-sm">
                <div className="text-3xl font-bold gradient-text">4.9</div>
                <div className="text-sm text-gray-600 flex items-center justify-center">
                  <Star className="w-3 h-3 text-yellow-500 mr-1 fill-current" />
                  Rating
                </div>
              </div>
            </div>

            {/* Features List */}
            <div className="space-y-4">
              <div className="flex items-center text-gray-700">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                Verified credentials & teaching experience
              </div>
              <div className="flex items-center text-gray-700">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                Personalized teaching methodology
              </div>
              <div className="flex items-center text-gray-700">
                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                Real-time doubt solving sessions
              </div>
            </div>
          </motion.div>

          {/* Right Side - Video/Animation */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-primary-600 to-secondary-600 aspect-video">
              {isPlaying ? (
                <video
                  className="w-full h-full object-cover"
                  controls
                  autoPlay
                  src="/videos/expert-intro.mp4"
                  onError={(e) => {
                    // If video fails to load, show placeholder
                    e.currentTarget.style.display = 'none';
                    setIsPlaying(false);
                  }}
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-8">
                  {/* Background pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
                      backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                      backgroundSize: '40px 40px'
                    }}></div>
                  </div>

                  {/* Lottie Animation or Placeholder */}
                  <div className="relative z-10">
                    {teacherAnimation ? (
                      <Lottie
                        animationData={teacherAnimation}
                        loop={true}
                        className="w-48 h-48"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center">
                        <BookOpen className="w-24 h-24 text-white/80" />
                      </div>
                    )}
                  </div>

                  {/* Play Button */}
                  <button
                    onClick={handlePlayVideo}
                    className="relative z-10 mt-6 group"
                    aria-label="Play expert introduction video"
                  >
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <Play className="w-8 h-8 text-primary-600 ml-1" fill="currentColor" />
                    </div>
                    <span className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-white text-sm whitespace-nowrap">
                      Watch Expert Introduction
                    </span>
                  </button>
                </div>
              )}

              {/* Decorative elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-yellow-400 rounded-full opacity-20 blur-xl"></div>
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-purple-400 rounded-full opacity-20 blur-xl"></div>
            </div>

            {/* Floating cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-4 hidden md:flex items-center space-x-3"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-gray-900">Verified Expert</div>
                <div className="text-sm text-gray-500">Quality Assured</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="absolute -top-6 -right-6 bg-white rounded-2xl shadow-xl p-4 hidden md:flex items-center space-x-3"
            >
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-primary-500 border-2 border-white flex items-center justify-center text-white text-xs">JD</div>
                <div className="w-8 h-8 rounded-full bg-secondary-500 border-2 border-white flex items-center justify-center text-white text-xs">SK</div>
                <div className="w-8 h-8 rounded-full bg-purple-500 border-2 border-white flex items-center justify-center text-white text-xs">AR</div>
              </div>
              <div>
                <div className="font-semibold text-gray-900">10,000+</div>
                <div className="text-sm text-gray-500">Happy Students</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ExpertVideo;
