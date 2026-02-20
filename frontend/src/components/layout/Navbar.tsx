import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown, User, LogOut, BookOpen, Globe } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import type { CurrencyCode } from '../../context/CurrencyContext';
import NotificationBell from '../NotificationBell';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const { user, logout } = useAuth();
  const { currency, setCurrency, currencies } = useCurrency();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-secondary-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold gradient-text">Zeal Catalyst</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
              Home
            </Link>
            <Link to="/find-tutors" className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
              Find Tutors
            </Link>
            <Link to="/how-it-works" className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
              How It Works
            </Link>
            <Link to="/about" className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
              About
            </Link>
            <Link to="/blog" className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
              Blog
            </Link>
            <Link to="/faqs" className="text-gray-700 hover:text-primary-600 font-medium transition-colors">
              FAQs
            </Link>
          </div>

          {/* Currency & Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Currency Selector */}
            <div className="relative">
              <button
                onClick={() => setShowCurrencyMenu(!showCurrencyMenu)}
                className="flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-700"
              >
                <Globe className="w-4 h-4" />
                <span className="font-medium">{currencies[currency].symbol} {currency}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showCurrencyMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                  {(Object.keys(currencies) as CurrencyCode[]).map((code) => (
                    <button
                      key={code}
                      onClick={() => {
                        setCurrency(code);
                        setShowCurrencyMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors ${
                        currency === code ? 'text-primary-600 bg-primary-50' : 'text-gray-700'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{currencies[code].symbol}</span>
                        <span>{code}</span>
                      </span>
                      {currency === code && <span className="text-primary-600">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {user ? (
              <>
                {/* Notification Bell */}
                <NotificationBell />

                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center space-x-3 px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-semibold">
                    {user.full_name?.charAt(0) || 'U'}
                  </div>
                  <span className="font-medium text-gray-700">{user.full_name || 'User'}</span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2">
                    <Link
                      to={user.role === 'admin' ? '/admin/dashboard' : user.role === 'tutor' ? '/tutor/dashboard' : '/student/dashboard'}
                      className="flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <User className="w-5 h-5 text-gray-500" />
                      <span>{user.role === 'admin' ? 'Admin Panel' : 'Dashboard'}</span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors w-full text-left text-red-600"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-outline">
                  Sign In
                </Link>
                <Link to="/register" className="btn-primary">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col space-y-4">
              <Link to="/" className="text-gray-700 hover:text-primary-600 font-medium py-2" onClick={() => setIsOpen(false)}>
                Home
              </Link>
              <Link to="/find-tutors" className="text-gray-700 hover:text-primary-600 font-medium py-2" onClick={() => setIsOpen(false)}>
                Find Tutors
              </Link>
              <Link to="/how-it-works" className="text-gray-700 hover:text-primary-600 font-medium py-2" onClick={() => setIsOpen(false)}>
                How It Works
              </Link>
              <Link to="/about" className="text-gray-700 hover:text-primary-600 font-medium py-2" onClick={() => setIsOpen(false)}>
                About
              </Link>
              <Link to="/blog" className="text-gray-700 hover:text-primary-600 font-medium py-2" onClick={() => setIsOpen(false)}>
                Blog
              </Link>
              <Link to="/faqs" className="text-gray-700 hover:text-primary-600 font-medium py-2" onClick={() => setIsOpen(false)}>
                FAQs
              </Link>
              <div className="pt-4 border-t border-gray-100 flex flex-col space-y-3">
                {user ? (
                  <>
                    <Link
                      to={user.role === 'admin' ? '/admin/dashboard' : user.role === 'tutor' ? '/tutor/dashboard' : '/student/dashboard'}
                      className="btn-primary w-full text-center"
                      onClick={() => setIsOpen(false)}
                    >
                      {user.role === 'admin' ? 'Admin Panel' : 'Dashboard'}
                    </Link>
                    <button onClick={handleLogout} className="btn-outline w-full">
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="btn-outline w-full text-center" onClick={() => setIsOpen(false)}>
                      Sign In
                    </Link>
                    <Link to="/register" className="btn-primary w-full text-center" onClick={() => setIsOpen(false)}>
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
