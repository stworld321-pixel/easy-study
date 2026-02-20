import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

// Component to handle icon with emoji fallback
const SubjectIcon: React.FC<{ icon: string; emoji: string; name: string }> = ({ icon, emoji, name }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <span className="text-4xl">{emoji}</span>;
  }

  return (
    <img
      src={icon}
      alt={name}
      className="w-12 h-12 object-contain"
      onError={() => setHasError(true)}
    />
  );
};

const subjects = [
  {
    name: 'Mathematics',
    icon: '/icons/maths.gif',
    emoji: '📐',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50',
    count: 450
  },
  {
    name: 'Physics',
    icon: '/icons/physics.gif',
    emoji: '⚛️',
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-50',
    count: 320
  },
  {
    name: 'Chemistry',
    icon: '/icons/chemistry.gif',
    emoji: '🧪',
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-50',
    count: 280
  },
  {
    name: 'English',
    icon: '/icons/english-language.gif',
    emoji: '📚',
    color: 'from-orange-500 to-amber-500',
    bgColor: 'bg-orange-50',
    count: 520
  },
  {
    name: 'Computer Science',
    icon: '/icons/computer science.gif',
    emoji: '💻',
    color: 'from-indigo-500 to-violet-500',
    bgColor: 'bg-indigo-50',
    count: 380
  },
  {
    name: 'Artificial Intelligence',
    icon: '/icons/artificial-intelligence.gif',
    emoji: '🤖',
    color: 'from-cyan-500 to-blue-500',
    bgColor: 'bg-cyan-50',
    count: 120
  },
  {
    name: 'Martial Arts',
    icon: '/icons/material arts.gif',
    emoji: '🥋',
    color: 'from-red-500 to-orange-500',
    bgColor: 'bg-red-50',
    count: 85
  },
  {
    name: 'Research',
    icon: '/icons/research.gif',
    emoji: '🔬',
    color: 'from-emerald-500 to-teal-500',
    bgColor: 'bg-emerald-50',
    count: 95
  },
  {
    name: 'Data Science',
    icon: '/icons/data science.gif',
    emoji: '📊',
    color: 'from-rose-500 to-red-500',
    bgColor: 'bg-rose-50',
    count: 190
  },
  {
    name: 'Design',
    icon: '/icons/design.gif',
    emoji: '🎨',
    color: 'from-fuchsia-500 to-purple-500',
    bgColor: 'bg-fuchsia-50',
    count: 150
  },
  {
    name: 'Languages',
    icon: '/icons/language.gif',
    emoji: '🌍',
    color: 'from-teal-500 to-cyan-500',
    bgColor: 'bg-teal-50',
    count: 290
  },
];

const Subjects: React.FC = () => {
  return (
    <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
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
            Explore <span className="gradient-text">Popular Subjects</span>
          </h2>
          <p className="section-subtitle mx-auto">
            Find expert tutors across a wide range of subjects
          </p>
        </motion.div>

        {/* Subjects Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {subjects.map((subject, index) => (
            <motion.div
              key={subject.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <Link
                to={`/find-tutors?subject=${encodeURIComponent(subject.name)}`}
                className="block group"
              >
                <div className="card p-6 text-center hover:scale-105 transition-all duration-300 hover:shadow-xl">
                  {/* Animated GIF Icon with Emoji Fallback */}
                  <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl ${subject.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <SubjectIcon icon={subject.icon} emoji={subject.emoji} name={subject.name} />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{subject.name}</h3>
                  <p className="text-sm text-gray-500">{subject.count}+ tutors</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Subjects;
