import React from 'react';
import { motion } from 'framer-motion';

const Terms: React.FC = () => {
  return (
    <div className="min-h-screen pt-20">
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
            <p className="text-xl text-white/80">Last updated: February 2026</p>
          </motion.div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-8 text-gray-700 leading-relaxed"
          >
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">1. Acceptance of Terms</h2>
              <p>By accessing and using EasyStudy ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform.</p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">2. Description of Service</h2>
              <p>EasyStudy is an online tutoring marketplace that connects students with qualified tutors for personalized learning sessions. We provide the platform for booking, scheduling, and conducting online tutoring sessions via Google Meet.</p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">3. User Accounts</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>You must provide accurate and complete information when creating an account.</li>
                <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
                <li>You must be at least 13 years old to use the platform. Users under 18 should have parental consent.</li>
                <li>One person may not maintain multiple accounts.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">4. For Tutors</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Tutors must provide accurate information about their qualifications and experience.</li>
                <li>Tutors are responsible for conducting sessions professionally and on time.</li>
                <li>EasyStudy charges a platform commission on each completed session.</li>
                <li>Withdrawal requests are subject to the minimum withdrawal amount set by the platform.</li>
                <li>Tutor profiles are subject to verification and may be suspended for violations.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">5. For Students</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Students agree to attend booked sessions on time.</li>
                <li>Cancellations should be made in advance according to the cancellation policy.</li>
                <li>Students are expected to behave respectfully during sessions.</li>
                <li>Payments are processed securely through our payment partners.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">6. Payments & Refunds</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>All payments are processed through secure payment gateways.</li>
                <li>Refunds for cancelled sessions are handled on a case-by-case basis.</li>
                <li>The platform reserves the right to hold payments in case of disputes.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">7. Prohibited Conduct</h2>
              <p>Users must not:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Share inappropriate or offensive content</li>
                <li>Attempt to bypass the platform for direct payments</li>
                <li>Impersonate another person or provide false information</li>
                <li>Use the platform for any unlawful purpose</li>
                <li>Interfere with the operation of the platform</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">8. Intellectual Property</h2>
              <p>All content on the platform, including logos, design, and software, is the property of EasyStudy. Study materials shared by tutors remain their intellectual property.</p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">9. Limitation of Liability</h2>
              <p>EasyStudy acts as a marketplace connecting tutors and students. We are not responsible for the quality of tutoring services. Our liability is limited to the fees paid for the platform services.</p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">10. Changes to Terms</h2>
              <p>We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the updated terms.</p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">11. Contact Us</h2>
              <p>For questions about these Terms of Service, contact us at <a href="mailto:support@easystudy.cloud" className="text-primary-600 hover:underline">support@easystudy.cloud</a></p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Terms;
