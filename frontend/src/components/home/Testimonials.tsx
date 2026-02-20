import React from 'react';
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Emily Thompson',
    role: 'University Student',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily',
    rating: 5,
    text: "Zeal Catalyst transformed my learning experience. My calculus tutor explained concepts in ways my professor couldn't. I went from struggling to acing my exams!",
  },
  {
    name: 'Michael Chen',
    role: 'Software Developer',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael',
    rating: 5,
    text: 'I needed to level up my Python skills for a career change. My tutor created a custom learning plan that helped me land my dream job in just 3 months.',
  },
  {
    name: 'Sarah Martinez',
    role: 'High School Student',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=SarahM',
    rating: 5,
    text: 'The IELTS prep tutoring was incredible. My tutor gave me strategies and practice that boosted my score from 6.0 to 8.0. Highly recommend!',
  },
  {
    name: 'David Kim',
    role: 'Business Professional',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
    rating: 5,
    text: "Learning Spanish for business trips became so much easier. The flexibility to schedule sessions around my work made it possible to actually stick with it.",
  },
  {
    name: 'Lisa Anderson',
    role: 'Parent',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa',
    rating: 5,
    text: "My daughter's confidence in math has skyrocketed. Her tutor makes learning fun and engaging. Best investment in her education we've ever made.",
  },
  {
    name: 'James Wilson',
    role: 'Graduate Student',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=JamesW',
    rating: 5,
    text: 'Found an amazing data science tutor who helped me with my thesis project. The one-on-one attention made complex topics finally click.',
  },
];

const Testimonials: React.FC = () => {
  return (
    <section className="py-24 bg-gradient-to-b from-white to-gray-50">
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
            What Our <span className="gradient-text">Students Say</span>
          </h2>
          <p className="section-subtitle mx-auto">
            Join thousands of satisfied learners who achieved their goals with Zeal Catalyst
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="card p-8 h-full relative">
                {/* Quote Icon */}
                <div className="absolute top-6 right-6">
                  <Quote className="w-8 h-8 text-primary-100" />
                </div>

                {/* Rating */}
                <div className="flex space-x-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>

                {/* Text */}
                <p className="text-gray-600 leading-relaxed mb-6">"{testimonial.text}"</p>

                {/* Author */}
                <div className="flex items-center space-x-4 mt-auto">
                  <img
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-500">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
