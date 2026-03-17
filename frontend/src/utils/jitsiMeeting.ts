import type { BookingResponse } from '../services/api';

const pad2 = (value: number): string => String(value).padStart(2, '0');

export const buildJitsiRoomName = (booking: BookingResponse): string => {
  if (booking.session_type === 'group') {
    const dt = new Date(booking.scheduled_at);
    const slotKey =
      `${dt.getUTCFullYear()}${pad2(dt.getUTCMonth() + 1)}${pad2(dt.getUTCDate())}` +
      `${pad2(dt.getUTCHours())}${pad2(dt.getUTCMinutes())}`;
    return `zealcatalyst-group-${booking.tutor_id}-${slotKey}-${booking.duration_minutes}`.toLowerCase();
  }
  return `zealcatalyst-private-${booking.id}`.toLowerCase();
};

export const isMeetingExpired = (booking: BookingResponse): boolean => {
  const start = new Date(booking.scheduled_at).getTime();
  const expiry = start + (booking.duration_minutes + 15) * 60_000;
  return Date.now() > expiry;
};

