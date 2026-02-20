import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UserPlus, Search, Calendar, Video, Star,
  MessageSquare, CreditCard, Award,
  Users, Clock, Shield, CheckCircle2, ArrowRight
} from 'lucide-react';

// Timeline steps for the main diagram (same as home page)
const timelineSteps = [
  {
    number: 1,
    icon: UserPlus,
    title: 'Create Your Profile',
    description: 'Sign up in minutes and tell us about your learning goals, preferred subjects, and schedule.',
    highlights: ['Free registration', 'Personalized dashboard', 'Learning preferences'],
    color: 'bg-blue-500',
    lightColor: 'bg-blue-50',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-200',
  },
  {
    number: 2,
    icon: Search,
    title: 'Find Your Perfect Tutor',
    description: 'Browse expert tutors, read reviews, watch intro videos, and find your ideal match.',
    highlights: ['Verified credentials', 'Student reviews', 'Trial lessons'],
    color: 'bg-purple-500',
    lightColor: 'bg-purple-50',
    textColor: 'text-purple-600',
    borderColor: 'border-purple-200',
  },
  {
    number: 3,
    icon: Calendar,
    title: 'Book Your Session',
    description: 'Choose a convenient time slot from your tutor\'s availability and confirm instantly.',
    highlights: ['Flexible scheduling', 'Instant confirmation', 'Calendar sync'],
    color: 'bg-emerald-500',
    lightColor: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    borderColor: 'border-emerald-200',
  },
  {
    number: 4,
    icon: Video,
    title: 'Start Learning',
    description: 'Join your live video session with interactive tools and begin your learning journey.',
    highlights: ['HD video calls', 'Screen sharing', 'Recording available'],
    color: 'bg-orange-500',
    lightColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-200',
  },
];

const studentSteps = [
  {
    icon: UserPlus,
    title: 'Create Your Profile',
    description: 'Sign up in minutes and tell us about your learning goals, preferred subjects, and availability.',
    color: 'from-primary-500 to-primary-600',
  },
  {
    icon: Search,
    title: 'Find Your Tutor',
    description: 'Browse our verified tutors, read reviews, and find the perfect match for your learning style.',
    color: 'from-secondary-500 to-secondary-600',
  },
  {
    icon: Calendar,
    title: 'Book a Session',
    description: 'Select a convenient time slot from your tutor\'s availability and book your lesson instantly.',
    color: 'from-green-500 to-green-600',
  },
  {
    icon: Video,
    title: 'Start Learning',
    description: 'Join your live video session with interactive tools, screen sharing, and collaborative features.',
    color: 'from-orange-500 to-orange-600',
  },
];

const tutorSteps = [
  {
    icon: UserPlus,
    title: 'Create Your Profile',
    description: 'Showcase your expertise, qualifications, and teaching experience to attract students.',
    color: 'from-primary-500 to-primary-600',
  },
  {
    icon: Clock,
    title: 'Set Your Schedule',
    description: 'Define your availability and hourly rate. You have complete control over when and how much you teach.',
    color: 'from-secondary-500 to-secondary-600',
  },
  {
    icon: MessageSquare,
    title: 'Accept Bookings',
    description: 'Review student requests and accept lessons that match your expertise and schedule.',
    color: 'from-green-500 to-green-600',
  },
  {
    icon: CreditCard,
    title: 'Get Paid',
    description: 'Receive secure payments directly to your account after completing lessons.',
    color: 'from-orange-500 to-orange-600',
  },
];

const features = [
  {
    icon: Shield,
    title: 'Verified Tutors',
    description: 'All tutors undergo background checks and credential verification.',
  },
  {
    icon: Star,
    title: 'Quality Guaranteed',
    description: 'Money-back guarantee if you\'re not satisfied with your first lesson.',
  },
  {
    icon: Users,
    title: 'Personalized Learning',
    description: 'One-on-one attention tailored to your specific needs and pace.',
  },
  {
    icon: Award,
    title: 'Track Progress',
    description: 'Monitor your improvement with detailed progress reports.',
  },
];

const HowItWorks: React.FC = () => {
  return (
    <div className="min-h-screen pt-20">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">How It Works</h1>
            <p className="text-xl text-white/80 max-w-3xl mx-auto">
              Getting started with Zeal Catalyst is simple. Whether you're a student looking
              to learn or a tutor ready to teach, we've made the process seamless.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Visual Timeline Diagram */}
      <section className="py-24 bg-gradient-to-b from-white via-gray-50 to-white relative overflow-hidden">
        {/* Subtle Background Decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-br from-primary-100/30 to-secondary-100/30 rounded-full blur-3xl -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <span className="inline-block px-4 py-2 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold mb-4">
              Simple Process
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Your Learning <span className="gradient-text">Journey</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
              Get started in four simple steps and begin your personalized learning journey today
            </p>
          </motion.div>

          {/* Steps - Desktop Timeline Layout */}
          <div className="hidden lg:block relative">
            {/* Timeline Line - Centered with nodes */}
            <div className="absolute top-6 left-[12.5%] right-[12.5%] h-1 bg-gradient-to-r from-blue-500 via-purple-500 via-emerald-500 to-orange-500 rounded-full" />

            <div className="grid grid-cols-4 gap-8">
              {timelineSteps.map((step, index) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                  className="relative"
                >
                  {/* Timeline Node */}
                  <div className="flex justify-center mb-6">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className={`w-12 h-12 ${step.color} rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg ring-4 ring-white relative z-10`}
                    >
                      {step.number}
                    </motion.div>
                  </div>

                  {/* Card */}
                  <motion.div
                    whileHover={{ y: -8, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)' }}
                    className={`bg-white rounded-2xl p-6 border-2 ${step.borderColor} shadow-lg transition-all duration-300 h-full`}
                  >
                    {/* Icon */}
                    <div className={`w-14 h-14 ${step.lightColor} rounded-xl flex items-center justify-center mb-4`}>
                      <step.icon className={`w-7 h-7 ${step.textColor}`} />
                    </div>

                    {/* Content */}
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">{step.description}</p>

                    {/* Highlights */}
                    <ul className="space-y-2">
                      {step.highlights.map((highlight, i) => (
                        <li key={i} className="flex items-center text-sm text-gray-500">
                          <CheckCircle2 className={`w-4 h-4 ${step.textColor} mr-2 flex-shrink-0`} />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Steps - Mobile/Tablet Layout */}
          <div className="lg:hidden space-y-6">
            {timelineSteps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative"
              >
                <div className={`bg-white rounded-2xl p-6 border-2 ${step.borderColor} shadow-lg`}>
                  <div className="flex items-start gap-4">
                    {/* Number & Icon */}
                    <div className="flex-shrink-0">
                      <div className={`w-14 h-14 ${step.color} rounded-xl flex items-center justify-center text-white shadow-lg`}>
                        <step.icon className="w-7 h-7" />
                      </div>
                      <div className={`mt-2 text-center font-bold ${step.textColor}`}>
                        Step {step.number}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                      <p className="text-gray-600 text-sm mb-3">{step.description}</p>

                      {/* Highlights */}
                      <div className="flex flex-wrap gap-2">
                        {step.highlights.map((highlight, i) => (
                          <span
                            key={i}
                            className={`inline-flex items-center px-2 py-1 ${step.lightColor} ${step.textColor} text-xs font-medium rounded-full`}
                          >
                            {highlight}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connector Arrow */}
                {index < timelineSteps.length - 1 && (
                  <div className="flex justify-center py-2">
                    <ArrowRight className="w-6 h-6 text-gray-300 rotate-90" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* For Students - Vertical Timeline */}
      <section className="py-24 bg-gradient-to-br from-primary-50 via-white to-blue-50 relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-20 right-0 w-72 h-72 bg-primary-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-0 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full text-sm font-semibold mb-4 shadow-lg shadow-primary-500/25">
              <Users className="w-4 h-4" />
              For Students
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Start Learning in <span className="gradient-text">4 Easy Steps</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Find your perfect tutor and begin your personalized learning journey
            </p>
          </motion.div>

          {/* Timeline Container */}
          <div className="relative">
            {/* Vertical Line - Desktop */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-primary-400 via-purple-400 via-emerald-400 to-orange-400 -translate-x-1/2 rounded-full" />

            {/* Steps */}
            <div className="space-y-12 md:space-y-0">
              {studentSteps.map((step, index) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                  className={`relative flex flex-col md:flex-row items-center gap-8 ${
                    index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                  } ${index !== studentSteps.length - 1 ? 'md:pb-16' : ''}`}
                >
                  {/* Card Side */}
                  <div className={`flex-1 w-full ${index % 2 === 0 ? 'md:text-right md:pr-12' : 'md:text-left md:pl-12'}`}>
                    <motion.div
                      whileHover={{ scale: 1.02, y: -5 }}
                      className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 inline-block w-full max-w-md"
                    >
                      <div className={`flex items-start gap-4 ${index % 2 === 0 ? 'md:flex-row-reverse md:text-right' : ''}`}>
                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-md`}>
                          <step.icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                          <p className="text-gray-600 text-sm leading-relaxed">{step.description}</p>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Center Node */}
                  <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 z-10">
                    <motion.div
                      whileHover={{ scale: 1.2 }}
                      className={`w-14 h-14 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center text-white font-bold text-xl shadow-lg ring-4 ring-white`}
                    >
                      {index + 1}
                    </motion.div>
                  </div>

                  {/* Mobile Step Number */}
                  <div className="md:hidden flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                      {index + 1}
                    </div>
                  </div>

                  {/* Empty Side for Balance */}
                  <div className="hidden md:block flex-1" />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-3 gap-4 mt-16 mb-8"
          >
            {[
              { value: '10K+', label: 'Happy Students' },
              { value: '95%', label: 'Success Rate' },
              { value: '24/7', label: 'Support Available' },
            ].map((stat, index) => (
              <div key={index} className="text-center py-4 px-2 rounded-xl bg-white/80 backdrop-blur border border-gray-100 shadow-sm">
                <div className="text-2xl md:text-3xl font-bold text-primary-600 mb-1">{stat.value}</div>
                <div className="text-xs md:text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-center"
          >
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold text-lg px-8 py-4 rounded-xl shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40 hover:from-primary-700 hover:to-primary-600 transition-all duration-300"
            >
              Get Started as Student
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="mt-4 text-gray-500 text-sm">
              No credit card required • Free to browse tutors
            </p>
          </motion.div>
        </div>
      </section>

      {/* For Tutors - Card Grid Layout */}
      <section className="py-24 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>

        {/* Gradient Orbs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-secondary-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-secondary-500 to-secondary-600 text-white rounded-full text-sm font-semibold mb-4 shadow-lg shadow-secondary-500/25">
              <Award className="w-4 h-4" />
              For Tutors
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              Start Teaching in <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary-400 to-primary-400">4 Easy Steps</span>
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Share your knowledge, set your own schedule, and earn doing what you love
            </p>
          </motion.div>

          {/* Horizontal Scroll Cards on Mobile, Grid on Desktop */}
          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            {tutorSteps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative"
              >
                {/* Card */}
                <div className="relative bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                  {/* Step Number Badge */}
                  <div className="absolute -top-3 -left-3 w-10 h-10 bg-gradient-to-br from-secondary-500 to-secondary-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold">{index + 1}</span>
                  </div>

                  <div className="flex items-start gap-5 pt-2">
                    {/* Icon Container */}
                    <div className={`flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <step.icon className="w-7 h-7 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-secondary-300 transition-colors">
                        {step.title}
                      </h3>
                      <p className="text-gray-400 leading-relaxed text-sm">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {/* Arrow Indicator */}
                  <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <ArrowRight className="w-4 h-4 text-secondary-400" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-3 gap-4 mt-12 mb-8"
          >
            {[
              { value: '500+', label: 'Active Tutors' },
              { value: '₹50K+', label: 'Avg. Monthly Earnings' },
              { value: '4.9', label: 'Tutor Satisfaction' },
            ].map((stat, index) => (
              <div key={index} className="text-center py-4 px-2 rounded-xl bg-white/5 border border-white/10">
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-xs md:text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-center mt-8"
          >
            <Link
              to="/register?role=tutor"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-secondary-500 to-secondary-600 text-white font-semibold text-lg px-8 py-4 rounded-xl shadow-xl shadow-secondary-500/25 hover:shadow-secondary-500/40 hover:from-secondary-600 hover:to-secondary-700 transition-all duration-300"
            >
              Become a Tutor
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="mt-4 text-gray-500 text-sm">
              Free to join • Start earning today
            </p>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="section-title mb-4">Why Choose Us</h2>
            <p className="section-subtitle mx-auto">
              We're committed to providing the best online tutoring experience
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="card p-6 text-center"
              >
                <div className="w-14 h-14 mx-auto mb-4 bg-primary-100 rounded-xl flex items-center justify-center">
                  <feature.icon className="w-7 h-7 text-primary-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-primary-600 to-secondary-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-xl text-white/80 mb-8">
              Join thousands of students and tutors on Zeal Catalyst today
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register" className="btn-primary bg-white text-primary-700 hover:bg-gray-100">
                Find a Tutor
              </Link>
              <Link to="/register?role=tutor" className="btn-outline border-white text-white hover:bg-white/10">
                Become a Tutor
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;
