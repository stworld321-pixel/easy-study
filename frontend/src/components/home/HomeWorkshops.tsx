import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Clock3, ExternalLink, Users } from 'lucide-react';
import { workshopsAPI } from '../../services/api';
import type { WorkshopResponse } from '../../services/api';
import { useCurrency } from '../../context/CurrencyContext';
import { formatDateTimeInIndia } from '../../utils/datetime';
import { isVideoUrl } from '../../utils/media';

const HomeWorkshops: React.FC = () => {
  const [workshops, setWorkshops] = useState<WorkshopResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const { formatPrice } = useCurrency();

  const isWorkshopExpired = useCallback((workshop: WorkshopResponse) => {
    const startTime = new Date(workshop.scheduled_at).getTime();
    if (Number.isNaN(startTime)) return false;
    return Date.now() >= startTime + (workshop.duration_minutes || 0) * 60_000;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchWorkshops = async () => {
      try {
        const data = await workshopsAPI.getPublicWorkshops({ upcoming_only: true, limit: 6 });
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setWorkshops(list.filter((workshop) => !isWorkshopExpired(workshop)).slice(0, 3));
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load homepage workshops:', error);
          setWorkshops([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchWorkshops();

    return () => {
      cancelled = true;
    };
  }, [isWorkshopExpired]);

  useEffect(() => {
    const interval = setInterval(() => {
      setWorkshops((current) => current.filter((workshop) => !isWorkshopExpired(workshop)));
    }, 60_000);

    return () => clearInterval(interval);
  }, [isWorkshopExpired]);

  const visibleWorkshops = useMemo(
    () => workshops.filter((workshop) => !isWorkshopExpired(workshop)),
    [isWorkshopExpired, workshops]
  );

  if (!loading && visibleWorkshops.length === 0) {
    return null;
  }

  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <h2 className="section-title mb-4">
              Upcoming <span className="gradient-text">Workshops</span>
            </h2>
            <p className="section-subtitle max-w-2xl">
              Join focused live workshops led by verified mentors.
            </p>
          </div>
          <Link
            to="/workshops"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary-200 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50"
          >
            View All
            <ExternalLink className="h-4 w-4" />
          </Link>
        </motion.div>

        {loading ? (
          <div className="text-gray-600">Loading workshops...</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visibleWorkshops.map((workshop, index) => (
              <motion.div
                key={workshop.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="card h-full overflow-hidden transition-all duration-300 hover:scale-[1.02]">
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100">
                    {workshop.thumbnail_url ? (
                      isVideoUrl(workshop.thumbnail_url) ? (
                        <video
                          src={workshop.thumbnail_url}
                          className="absolute inset-0 h-full w-full object-cover object-top"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={workshop.thumbnail_url}
                          alt={workshop.title}
                          className="absolute inset-0 h-full w-full object-cover object-top"
                          loading="lazy"
                        />
                      )
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-400">No image</div>
                    )}
                  </div>

                  <div className="p-6">
                    <h3 className="line-clamp-2 text-lg font-semibold text-gray-900">{workshop.title}</h3>
                    <p className="mt-1 text-sm text-gray-600">By {workshop.tutor_name || 'Tutor'}</p>

                    <div className="mt-4 space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {formatDateTimeInIndia(workshop.scheduled_at)} IST
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4" />
                        {workshop.duration_minutes} mins
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {workshop.max_participants} seats
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-5">
                      <span className="text-lg font-bold text-primary-700">{formatPrice(workshop.amount)}</span>
                      <Link
                        to={`/workshops/${workshop.id}`}
                        className="btn-primary px-4 py-2 text-sm"
                      >
                        Book Workshop
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default HomeWorkshops;
