import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

const faqCategories = [
  {
    name: 'General',
    faqs: [
      {
        question: 'What is Zeal Catalyst?',
        answer: 'Zeal Catalyst is an online tutoring platform that connects students with expert tutors from around the world. We offer personalized one-on-one and group tutoring sessions across a wide range of subjects.',
      },
      {
        question: 'How does online tutoring work?',
        answer: 'Our platform uses video conferencing technology to connect you with your tutor in real-time. Sessions include interactive features like screen sharing, virtual whiteboards, and file sharing to enhance the learning experience.',
      },
      {
        question: 'What subjects do you offer?',
        answer: 'We offer tutoring in over 100 subjects including Mathematics, Sciences, Languages, Computer Science, Business, Arts, and more. Check our Find Tutors page to see the full list of available subjects.',
      },
    ],
  },
  {
    name: 'For Students',
    faqs: [
      {
        question: 'How do I find a tutor?',
        answer: 'Use our Find Tutors page to browse available tutors. You can filter by subject, price, availability, and read reviews from other students. Once you find a tutor you like, you can book a session directly.',
      },
      {
        question: 'What if I\'m not satisfied with my lesson?',
        answer: 'We offer a satisfaction guarantee on your first lesson with any new tutor. If you\'re not happy with the session, contact our support team within 24 hours for a full refund or credit.',
      },
      {
        question: 'How do I pay for lessons?',
        answer: 'Payment is processed securely through our platform. You can pay using credit/debit cards or PayPal. Payment is collected when you book a lesson, and the tutor receives payment after the session is completed.',
      },
      {
        question: 'Can I reschedule or cancel a lesson?',
        answer: 'Yes, you can reschedule or cancel a lesson up to 24 hours before the scheduled time without any penalty. Cancellations within 24 hours may be subject to a fee depending on the tutor\'s policy.',
      },
    ],
  },
  {
    name: 'For Tutors',
    faqs: [
      {
        question: 'How do I become a tutor?',
        answer: 'Click on "Become a Tutor" and complete our application process. You\'ll need to provide information about your qualifications, experience, and undergo our verification process. Once approved, you can set up your profile and start accepting students.',
      },
      {
        question: 'How much can I earn as a tutor?',
        answer: 'You set your own hourly rate based on your experience and subject expertise. Tutors on our platform earn anywhere from $20 to $150+ per hour. The platform takes a 15% commission on each lesson.',
      },
      {
        question: 'When do I get paid?',
        answer: 'Payments are processed weekly. Funds are released 48 hours after a completed lesson and transferred to your account via your preferred payment method (bank transfer or PayPal).',
      },
      {
        question: 'How do I manage my schedule?',
        answer: 'Our calendar system lets you set your availability, block off time, and manage bookings. Students can only book lessons during times you\'ve marked as available.',
      },
    ],
  },
  {
    name: 'Technical',
    faqs: [
      {
        question: 'What equipment do I need?',
        answer: 'You need a computer or tablet with a webcam, microphone, and stable internet connection. We recommend using Chrome or Firefox for the best experience.',
      },
      {
        question: 'What if I have technical issues during a lesson?',
        answer: 'Our support team is available 24/7 to help resolve technical issues. If a lesson is disrupted due to technical problems on our end, we\'ll provide a full refund or credit.',
      },
      {
        question: 'Is my data secure?',
        answer: 'Yes, we take security seriously. All data is encrypted, and we follow industry best practices for data protection. We never share your personal information with third parties without your consent.',
      },
    ],
  },
];

const FAQItem: React.FC<{ faq: { question: string; answer: string } }> = ({ faq }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left"
      >
        <span className="font-medium text-gray-900 pr-4">{faq.question}</span>
        <ChevronDown
          className={`w-5 h-5 text-gray-500 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-6 text-gray-600 leading-relaxed">{faq.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FAQs: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('General');

  const filteredFaqs = faqCategories.map((category) => ({
    ...category,
    faqs: category.faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  }));

  const currentCategory = filteredFaqs.find((c) => c.name === activeCategory);

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
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Frequently Asked Questions</h1>
            <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">
              Find answers to common questions about our platform
            </p>

            {/* Search */}
            <div className="max-w-xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for answers..."
                className="w-full pl-12 pr-4 py-4 bg-white text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            {faqCategories.map((category) => (
              <button
                key={category.name}
                onClick={() => setActiveCategory(category.name)}
                className={`px-6 py-2 rounded-full font-medium transition-colors ${
                  activeCategory === category.name
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* FAQ List */}
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="card p-6 md:p-8"
          >
            {currentCategory && currentCategory.faqs.length > 0 ? (
              currentCategory.faqs.map((faq, index) => (
                <FAQItem key={index} faq={faq} />
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No matching questions found</p>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="w-16 h-16 mx-auto mb-6 bg-primary-100 rounded-full flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Still have questions?</h2>
            <p className="text-gray-600 mb-8">
              Our support team is here to help. Get in touch and we'll get back to you as soon as possible.
            </p>
            <Link to="/contact" className="btn-primary">
              Contact Support
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default FAQs;
