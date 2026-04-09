import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock3, Search, Users } from 'lucide-react';
import { workshopsAPI } from '../services/api';
import type { WorkshopResponse } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { DEMO_WORKSHOP } from '../utils/demoWorkshop';

const Workshops: React.FC = () => {
  const [workshops, setWorkshops] = useState<WorkshopResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const { formatPrice } = useCurrency();

  useEffect(() => {
    const fetchWorkshops = async () => {
      setLoading(true);
      setError('');
      try {
        const upcoming = await workshopsAPI.getPublicWorkshops({ upcoming_only: true, limit: 100 });
        const upcomingList = Array.isArray(upcoming) ? upcoming : [];

        if (upcomingList.length > 0) {
          setWorkshops(
            upcomingList.some((w) => w.id === DEMO_WORKSHOP.id)
              ? upcomingList
              : [DEMO_WORKSHOP, ...upcomingList]
          );
        } else {
          // Fallback: show active workshops even if schedule is in the past/timezone mismatch.
          const allActive = await workshopsAPI.getPublicWorkshops({ upcoming_only: false, limit: 100 });
          const list = Array.isArray(allActive) ? allActive : [];
          setWorkshops(list.some((w) => w.id === DEMO_WORKSHOP.id) ? list : [DEMO_WORKSHOP, ...list]);
        }
      } catch {
        // Still show demo workshop when API is unavailable.
        setWorkshops([DEMO_WORKSHOP]);
        setError('');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkshops();
  }, []);

  const filteredWorkshops = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return workshops;
    return workshops.filter((w) =>
      [w.title, w.description, w.tutor_name, ...(w.modules || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [workshops, query]);

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Workshops</h1>
          <p className="text-gray-600 mt-2">Discover upcoming workshops and enroll in the sessions you need.</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workshops by title, tutor, modules..."
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-gray-600">Loading workshops...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : filteredWorkshops.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-600">
            No workshops found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkshops.map((workshop) => (
              <div key={workshop.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-[16/9] bg-gray-100">
                  {workshop.thumbnail_url ? (
                    <img src={workshop.thumbnail_url} alt={workshop.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">No image</div>
                  )}
                </div>
                <div className="p-5">
                  <h2 className="text-lg font-semibold text-gray-900 line-clamp-2">{workshop.title}</h2>
                  <p className="text-sm text-gray-600 mt-1">By {workshop.tutor_name || 'Tutor'}</p>

                  <div className="mt-4 space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {new Date(workshop.scheduled_at).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="w-4 h-4" />
                      {workshop.duration_minutes} mins
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {workshop.max_participants} seats
                    </div>
                  </div>

                  <div className="mt-4 text-primary-700 font-semibold">
                    {formatPrice(workshop.amount)}
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <Link
                      to={`/workshops/${workshop.id}`}
                      className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 text-sm font-medium"
                    >
                      View Details
                    </Link>
                    <Link
                      to={`/workshops/${workshop.id}`}
                      className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 text-sm font-medium"
                    >
                      Book Workshop
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Workshops;
