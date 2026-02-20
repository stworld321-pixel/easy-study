import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, Search, Calendar, Video, ArrowRight, CheckCircle2 } from 'lucide-react';

const steps = [
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

const HowItWorksPreview: React.FC = () => {
  return (
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
            How It <span className="gradient-text">Works</span>
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
            {steps.map((step, index) => (
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
          {steps.map((step, index) => (
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
              {index < steps.length - 1 && (
                <div className="flex justify-center py-2">
                  <ArrowRight className="w-6 h-6 text-gray-300 rotate-90" />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center mt-28 relative z-20"
        >
          <Link
            to="/find-tutors"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-semibold text-lg px-10 py-4 rounded-xl shadow-xl shadow-primary-500/25 hover:shadow-primary-500/40 hover:from-primary-700 hover:to-primary-600 transition-all duration-300"
          >
            Get Started Now
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="mt-4 text-gray-500 text-sm">
            No credit card required • Free to browse tutors
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorksPreview;
