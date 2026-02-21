import React from 'react';
import { motion } from 'framer-motion';

const Privacy: React.FC = () => {
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
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
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
              <h2 className="text-2xl font-bold text-gray-900 mb-3">1. Information We Collect</h2>
              <p>When you use Zeal Catalyst, we collect the following information:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Account Information:</strong> Name, email address, phone number, and profile picture when you create an account.</li>
                <li><strong>Profile Information:</strong> For tutors, we collect education details, subjects, experience, and hourly rates.</li>
                <li><strong>Payment Information:</strong> Payment details processed securely through our payment partners (Razorpay).</li>
                <li><strong>Usage Data:</strong> Booking history, session details, and platform interactions.</li>
                <li><strong>Communications:</strong> Messages, reviews, and feedback exchanged on the platform.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">2. How We Use Your Information</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>To create and manage your account</li>
                <li>To connect students with tutors and facilitate bookings</li>
                <li>To process payments and withdrawals</li>
                <li>To send booking confirmations, reminders, and notifications</li>
                <li>To generate Google Meet links for online sessions</li>
                <li>To improve our platform and user experience</li>
                <li>To respond to customer support requests</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">3. Information Sharing</h2>
              <p>We do not sell your personal information. We share your information only in the following cases:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Between Students and Tutors:</strong> Relevant profile information is shared to facilitate sessions.</li>
                <li><strong>Payment Processors:</strong> Payment information is shared with Razorpay for transaction processing.</li>
                <li><strong>Google Services:</strong> Email addresses may be shared with Google Calendar for creating meeting links.</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights.</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">4. Data Security</h2>
              <p>We implement appropriate security measures to protect your personal information, including encrypted connections (SSL/TLS), secure password hashing, and access controls. However, no method of transmission over the internet is 100% secure.</p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">5. Google Data Usage (Google Calendar Integration)</h2>
              <p>If you are a tutor and choose to connect your Google account, Zeal Catalyst requests limited Google Calendar access only to support tutoring session scheduling.</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>What we access:</strong> We access only the minimum Google Calendar data required to create, update, and delete tutoring session events, generate Google Meet links, and add booked student attendee emails when applicable.</li>
                <li><strong>What we do not access:</strong> We do not use Google data for advertising, we do not sell Google user data, and we do not access unrelated Google services.</li>
                <li><strong>How data is used:</strong> Google Calendar data is used only for scheduling and online session management features inside Zeal Catalyst.</li>
                <li><strong>Revocation:</strong> Tutors can disconnect Google Calendar at any time from the Tutor Dashboard, and can also revoke access from Google Account permissions.</li>
              </ul>
              <p className="mt-3">
                Zeal Catalyst&apos;s use of information received from Google APIs complies with the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:underline"
                >
                  Google API Services User Data Policy
                </a>, including Limited Use requirements.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">6. Cookies</h2>
              <p>We use essential cookies and local storage to maintain your login session and preferences. We do not use third-party tracking cookies for advertising purposes.</p>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">7. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Access and download your personal data</li>
                <li>Update or correct your information</li>
                <li>Delete your account and associated data</li>
                <li>Opt out of non-essential communications</li>
              </ul>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">8. Contact Us</h2>
              <p>If you have any questions about this Privacy Policy, please contact us at <a href="mailto:support@easystudy.cloud" className="text-primary-600 hover:underline">support@easystudy.cloud</a></p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Privacy;
