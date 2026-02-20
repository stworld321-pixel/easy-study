import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Instagram } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">Zeal Catalyst</span>
            </Link>
            <p className="text-gray-400 leading-relaxed">
              Connect with expert tutors worldwide. Personalized learning experiences tailored to your goals.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-primary-600 transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-primary-600 transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-primary-600 transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-primary-600 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-6">Quick Links</h3>
            <ul className="space-y-4">
              <li>
                <Link to="/find-tutors" className="hover:text-white transition-colors">Find Tutors</Link>
              </li>
              <li>
                <Link to="/how-it-works" className="hover:text-white transition-colors">How It Works</Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-white transition-colors">About Us</Link>
              </li>
              <li>
                <Link to="/faqs" className="hover:text-white transition-colors">FAQs</Link>
              </li>
              <li>
                <Link to="/register?role=tutor" className="hover:text-white transition-colors">Become a Tutor</Link>
              </li>
            </ul>
          </div>

          {/* Subjects */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-6">Popular Subjects</h3>
            <ul className="space-y-4">
              <li>
                <Link to="/find-tutors?subject=Mathematics" className="hover:text-white transition-colors">Mathematics</Link>
              </li>
              <li>
                <Link to="/find-tutors?subject=Physics" className="hover:text-white transition-colors">Physics</Link>
              </li>
              <li>
                <Link to="/find-tutors?subject=English" className="hover:text-white transition-colors">English</Link>
              </li>
              <li>
                <Link to="/find-tutors?subject=Computer Science" className="hover:text-white transition-colors">Computer Science</Link>
              </li>
              <li>
                <Link to="/find-tutors?subject=Data Science" className="hover:text-white transition-colors">Data Science</Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-6">Contact Us</h3>
            <ul className="space-y-4">
              <li className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-primary-500" />
                <a href="mailto:Zealcatalyst.zeca@gmail.com" className="hover:text-white transition-colors">
                  Zealcatalyst.zeca@gmail.com
                </a>
              </li>
              <li className="flex items-start space-x-3">
                <Phone className="w-5 h-5 text-primary-500 mt-1" />
                <div className="flex flex-col">
                  <a href="tel:+919790205149" className="hover:text-white transition-colors">+91 97902 05149</a>
                </div>
              </li>
              <li className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-primary-500 mt-1" />
                <div className="flex flex-col space-y-2">
                  <span className="text-sm">
                    <strong className="text-white">Dubai:</strong><br />
                    203, Al Faraj Building,<br />
                    Al Nahda 2, Dubai, UAE
                  </span>
                  <span className="text-sm">
                    <strong className="text-white">Chennai:</strong><br />
                    No.5, Thiruvalluvar Nagar,<br />
                    Chrompet, Chennai-44, India
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Zeal Catalyst. All rights reserved.
          </p>
          <div className="flex space-x-6 text-sm">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
