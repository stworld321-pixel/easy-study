// Shared timezone-aware datetime helpers.
//
// Storage convention: backend stores every booking instant as UTC and
// serializes it as an ISO string ending in "Z". That means the frontend
// can safely do `new Date(booking.scheduled_at).toLocaleString()` and
// the browser will render the instant in the viewer's local timezone.
//
// The tricky direction is outgoing: when a student picks "14:00" from a
// tutor's calendar, that HH:MM is meaningful in the *tutor's* timezone
// (that's how the tutor defined their availability). We have to turn
// that tutor-local wall time into a UTC instant before sending it.

export const getBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

// Convert a wall-clock date + time in a specific IANA timezone to a UTC
// ISO string ending in "Z".
//
// Example: zonedDateTimeToUtcIso('2026-04-15', '14:00', 'Asia/Kolkata')
//          -> '2026-04-15T08:30:00.000Z'
//
// Algorithm: pretend the wall time is already UTC, then ask Intl what
// that instant *looks like* in the target timezone. The difference
// between the two is the zone offset, which we subtract to land on the
// real UTC instant.
export const zonedDateTimeToUtcIso = (
  dateStr: string,
  timeStr: string,
  timeZone: string,
): string => {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  if ([y, mo, d, h, mi].some(Number.isNaN)) {
    throw new Error(`Invalid date/time: ${dateStr} ${timeStr}`);
  }

  const asUtcMs = Date.UTC(y, mo - 1, d, h, mi, 0, 0);

  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(asUtcMs));
  } catch {
    // Unknown timezone — fall back to treating the input as UTC.
    return new Date(asUtcMs).toISOString();
  }

  const get = (type: string): number => {
    const p = parts.find((x) => x.type === type);
    return p ? Number(p.value) : NaN;
  };

  let hour = get('hour');
  // Some engines emit "24" for midnight — normalize it.
  if (hour === 24) hour = 0;

  const zonedAsUtcMs = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
  );

  const offsetMs = zonedAsUtcMs - asUtcMs;
  return new Date(asUtcMs - offsetMs).toISOString();
};
