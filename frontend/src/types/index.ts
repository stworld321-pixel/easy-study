export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'student' | 'tutor' | 'admin';
  phone?: string;
  avatar?: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface TutorProfile {
  id: string;
  user_id: string;
  full_name?: string;
  email?: string;
  avatar?: string;
  headline?: string;
  bio?: string;
  experience_years: number;
  education?: string;
  certifications: string[];
  hourly_rate: number;
  group_hourly_rate?: number;
  currency: string;
  languages: string[];
  teaching_style?: string;
  subjects: string[];
  country?: string;
  city?: string;
  timezone?: string;
  offers_private: boolean;
  offers_group: boolean;
  total_students: number;
  total_lessons: number;
  rating: number;
  total_reviews: number;
  is_verified: boolean;
  is_featured: boolean;
  is_available: boolean;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  category?: string;
  icon?: string;
}

export interface Booking {
  id: string;
  student_id: string;
  tutor_id: string;
  student_name?: string;
  tutor_name?: string;
  subject: string;
  session_type: 'private' | 'group';
  scheduled_at: string;
  duration_minutes: number;
  price: number;
  currency: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes?: string;
  meeting_link?: string;
  created_at: string;
}

export interface Review {
  id: string;
  student_id: string;
  tutor_id: string;
  student_name?: string;
  student_avatar?: string;
  rating: number;
  comment?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}
