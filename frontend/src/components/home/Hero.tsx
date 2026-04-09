import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';
import { Search, Play, Star, Users, BookOpen, Award } from 'lucide-react';
import CountUp from '../ui/CountUp';
import {
  DEFAULT_SUBJECTS,
  HERO_SEARCH_SUGGESTIONS,
  normalizeSearchTerm,
  resolveSubjectFilterFromQuery,
} from '../../utils/tutorSearch';

const Hero: React.FC = () => {
  const [teacherAnimation, setTeacherAnimation] = useState(null);
  const [query, setQuery] = useState('');
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const navigate = useNavigate();
  const searchWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/animations/Teacher.json')
      .then(response => response.json())
      .then(data => setTeacherAnimation(data))
      .catch(err => console.error('Failed to load animation:', err));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!searchWrapperRef.current) return;
      if (!searchWrapperRef.current.contains(event.target as Node)) {
        setIsSuggestionOpen(false);
        setActiveSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSuggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    const normalized = normalizeSearchTerm(term);
    if (!term) return HERO_SEARCH_SUGGESTIONS.slice(0, 8);
    return HERO_SEARCH_SUGGESTIONS
      .filter((item) => {
        const label = item.toLowerCase();
        return label.includes(term) || (normalized && label.includes(normalized));
      })
      .slice(0, 8);
  }, [query]);

  const runSearch = (rawQuery?: string) => {
    const value = (rawQuery ?? query).trim();
    if (!value) {
      navigate('/find-tutors');
      return;
    }

    const exactSubject = resolveSubjectFilterFromQuery(value, DEFAULT_SUBJECTS);

    const params = new URLSearchParams();
    params.set('q', value);
    if (exactSubject) {
      params.set('subject', exactSubject);
    }
    navigate(`/find-tutors?${params.toString()}`);
    setIsSuggestionOpen(false);
    setActiveSuggestionIndex(-1);
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSuggestionOpen && event.key !== 'Enter') return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : 0
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex((prev) =>
        prev > 0 ? prev - 1 : filteredSuggestions.length - 1
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (isSuggestionOpen && activeSuggestionIndex >= 0 && filteredSuggestions[activeSuggestionIndex]) {
        const selected = filteredSuggestions[activeSuggestionIndex];
        setQuery(selected);
        runSearch(selected);
        return;
      }
      runSearch();
      return;
    }

    if (event.key === 'Escape') {
      setIsSuggestionOpen(false);
      setActiveSuggestionIndex(-1);
    }
  };

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
              <span className="block gradient-text">Subject Matter Specialists</span>
              Worldwide
            </h1>

            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0">
              Learn from world-class subject experts with personalized mentoring experiences.
              Flexible scheduling, proven methods, and outcomes that matter.
            </p>

            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <div className="relative flex-1" ref={searchWrapperRef}>
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="What do you want to learn?"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setIsSuggestionOpen(true);
                    setActiveSuggestionIndex(-1);
                  }}
                  onFocus={() => setIsSuggestionOpen(true)}
                  onKeyDown={onSearchKeyDown}
                  className="w-full pl-12 pr-4 py-4 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-lg"
                />
                {isSuggestionOpen && filteredSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                    {filteredSuggestions.map((suggestion, index) => (
                      <button
                        key={suggestion}
                        type="button"
                        className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                          index === activeSuggestionIndex
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                        onMouseEnter={() => setActiveSuggestionIndex(index)}
                        onClick={() => {
                          setQuery(suggestion);
                          runSearch(suggestion);
                        }}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Search className="w-4 h-4 text-gray-400" />
                          {suggestion}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => runSearch()}
                className="btn-primary px-8 whitespace-nowrap"
              >
                Find Experts
              </button>
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
