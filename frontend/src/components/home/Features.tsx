import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Lottie from 'lottie-react';
import { Users, Calendar, Video, Shield, Globe, Headphones } from 'lucide-react';

interface FeatureData {
  icon: React.ElementType;
  animationFile?: string;
  title: string;
  description: string;
  gradient: string;
}

const features: FeatureData[] = [
  {
    icon: Users,
    animationFile: 'teacher.json',
    title: 'Expert Tutors',
    description: 'Learn from qualified professionals with verified credentials and proven teaching experience.',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Calendar,
    animationFile: 'calendar.json',
    title: 'Flexible Scheduling',
    description: 'Book lessons at your convenience. Choose times that work with your busy schedule.',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    icon: Video,
    animationFile: 'video-call.json',
    title: 'Live Video Sessions',
    description: 'Interactive one-on-one sessions with screen sharing and collaborative tools.',
    gradient: 'from-green-500 to-emerald-500',
  },
  {
    icon: Shield,
    animationFile: 'shield.json',
    title: 'Secure Payments',
    description: 'Safe and secure payment processing with money-back guarantee on first lesson.',
    gradient: 'from-orange-500 to-amber-500',
  },
  {
    icon: Globe,
    animationFile: 'globe.json',
    title: 'Global Community',
    description: 'Connect with tutors from around the world. Learn in any language you prefer.',
    gradient: 'from-indigo-500 to-violet-500',
  },
  {
    icon: Headphones,
    animationFile: 'support.json',
    title: '24/7 Support',
    description: 'Our dedicated support team is always ready to help you with any questions.',
    gradient: 'from-rose-500 to-red-500',
  },
];

interface AnimatedIconProps {
  animationFile?: string;
  fallbackIcon: React.ElementType;
}

const AnimatedIcon: React.FC<AnimatedIconProps> = ({ animationFile, fallbackIcon: FallbackIcon }) => {
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    if (animationFile) {
      fetch(`/animations/icons/${animationFile}`)
        .then(response => {
          if (!response.ok) throw new Error('Not found');
          return response.json();
        })
        .then(data => setAnimationData(data))
        .catch(() => {
          // Silently fail and use fallback icon
        });
    }
  }, [animationFile]);

  if (animationData) {
    return (
      <Lottie
        animationData={animationData}
        loop={true}
        className="w-10 h-10"
      />
    );
  }

  return <FallbackIcon className="w-8 h-8 text-white" />;
};

const Features: React.FC = () => {
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
            Why Choose <span className="gradient-text">Zeal Catalyst</span>
          </h2>
          <p className="section-subtitle mx-auto">
            We provide the best online tutoring experience with features designed to help you succeed
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group"
            >
              <div className="card p-8 h-full hover:scale-105 transition-transform duration-300 hover:shadow-2xl">
                {/* Animated Icon Container */}
                <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <AnimatedIcon
                    animationFile={feature.animationFile}
                    fallbackIcon={feature.icon}
                  />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
