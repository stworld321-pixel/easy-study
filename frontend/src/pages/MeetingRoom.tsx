import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { bookingsAPI, type BookingResponse, type MeetingAccessResponse } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { isMeetingExpired } from '../utils/jitsiMeeting';

type JitsiApiInstance = {
  addListener: (event: string, callback: (...args: unknown[]) => void) => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
  dispose: () => void;
};

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => JitsiApiInstance;
  }
}

const MeetingRoom: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [meetingAccess, setMeetingAccess] = useState<MeetingAccessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // When the tutor hasn't opened the room yet, students sit on this
  // waiting screen and we re-poll /meeting-access until the backend
  // latches `tutor_joined_at`. Blocking students from joining first is
  // what prevents them from silently becoming the Jitsi moderator.
  const [waitingForTutor, setWaitingForTutor] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<JitsiApiInstance | null>(null);

  const normalizeDomain = (raw: string): string =>
    raw
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '')
      .split('/')[0];

  const jitsiDomain = normalizeDomain(meetingAccess?.domain || (import.meta.env.VITE_JITSI_DOMAIN as string) || 'meet.jit.si');
  const roomName = meetingAccess?.room_name || '';
  const appMeetingUrl = useMemo(() => {
    if (!booking?.id) return '';
    return `${window.location.origin}/meeting/${booking.id}`;
  }, [booking?.id]);

  const sessionEndTime = useMemo(() => {
    if (!booking?.scheduled_at) return null;
    const start = new Date(booking.scheduled_at).getTime();
    return start + ((booking.duration_minutes || 0) * 60_000);
  }, [booking?.scheduled_at, booking?.duration_minutes]);

  useEffect(() => {
    if (!bookingId) {
      setError('Invalid booking link.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    type StructuredDetail = {
      code?: string;
      message?: string;
      join_available_at?: string;
    };

    const attemptFetch = async (isPoll: boolean) => {
      try {
        const [data, access] = await Promise.all([
          bookingsAPI.getById(bookingId),
          bookingsAPI.getMeetingAccess(bookingId),
        ]);
        if (cancelled) return;
        if (data.status !== 'confirmed') {
          setError('This session is not confirmed yet.');
          setWaitingForTutor(false);
        } else if (isMeetingExpired(data)) {
          setError('This session link has expired.');
          setWaitingForTutor(false);
        } else {
          setBooking(data);
          setMeetingAccess(access);
          setError(null);
          setWaitingForTutor(false);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const apiError = err as {
          response?: {
            data?: {
              detail?: string | StructuredDetail;
              message?: string;
            };
          };
          message?: string;
        };
        const rawDetail = apiError?.response?.data?.detail;

        // Student hit /meeting-access before the tutor has checked in
        // — stay on the waiting-room screen and retry.
        if (
          rawDetail &&
          typeof rawDetail === 'object' &&
          rawDetail.code === 'waiting_for_tutor'
        ) {
          setWaitingForTutor(true);
          setError(null);
          pollTimer = setTimeout(() => attemptFetch(true), 8000);
          return;
        }

        let detail: string;
        if (
          rawDetail &&
          typeof rawDetail === 'object' &&
          rawDetail.code === 'session_not_open' &&
          rawDetail.join_available_at
        ) {
          // `join_available_at` is a UTC ISO string — `new Date(...)` parses
          // it as UTC and `toLocaleString` renders it in the viewer's local
          // timezone, which is what the user actually wants to see.
          const localJoinAt = new Date(rawDetail.join_available_at).toLocaleString(
            undefined,
            { dateStyle: 'medium', timeStyle: 'short' },
          );
          detail = `Session is not open yet. You can join after ${localJoinAt}.`;
        } else if (typeof rawDetail === 'string') {
          detail = rawDetail;
        } else {
          detail =
            rawDetail?.message ||
            apiError?.response?.data?.message ||
            apiError?.message ||
            'Unable to load this session.';
        }
        setError(detail);
        setWaitingForTutor(false);
      } finally {
        if (!cancelled && !isPoll) {
          setLoading(false);
        }
      }
    };

    attemptFetch(false);

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [bookingId]);

  // Tutor-initiated room rotation. Rotates the meeting_room_key on the
  // backend so a fresh Jitsi room is created; the tutor is guaranteed
  // to be the first joiner (and therefore moderator) of the new room.
  // Students still inside the old room will follow via the room-sync
  // poll below.
  const handleRestartMeeting = useCallback(async () => {
    if (!bookingId || restarting) return;
    setRestarting(true);
    try {
      const fresh = await bookingsAPI.restartMeeting(bookingId);
      // Tear down the current Jitsi embed; the setup effect will re-run
      // with the new roomName and mount a fresh room.
      try {
        apiRef.current?.dispose();
      } catch {
        // Ignore disposal errors — re-mount will still work.
      }
      apiRef.current = null;
      setMeetingAccess(fresh);
    } catch (err) {
      console.error('Failed to restart meeting:', err);
    } finally {
      setRestarting(false);
    }
  }, [bookingId, restarting]);

  // Room-sync poll: while the meeting is mounted, periodically re-fetch
  // /meeting-access. If the backend has rotated the room_key (because
  // the tutor clicked Reset after reconnecting), all non-tutor clients
  // notice the new room_name and remount Jitsi into the fresh room.
  // This keeps students from being stranded in the old Jitsi channel.
  useEffect(() => {
    if (!bookingId || !meetingAccess?.room_name) return;
    const currentRoom = meetingAccess.room_name;

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const fresh = await bookingsAPI.getMeetingAccess(bookingId);
        if (cancelled) return;
        if (fresh.room_name && fresh.room_name !== currentRoom) {
          try {
            apiRef.current?.dispose();
          } catch {
            // Ignore — remount will still happen.
          }
          apiRef.current = null;
          setMeetingAccess(fresh);
        }
      } catch {
        // Transient errors are expected (network blips, brief 403 during
        // rotation). Just try again on the next tick.
      }
    };

    const interval = setInterval(tick, 12000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [bookingId, meetingAccess?.room_name]);

  useEffect(() => {
    if (!booking || !roomName || !containerRef.current) return;
    let lobbyEnabled = false;

    const setupMeeting = () => {
      if (!window.JitsiMeetExternalAPI || !containerRef.current) {
        setError('Jitsi failed to load in embedded mode. You can still open the session in a new tab.');
        return;
      }

      apiRef.current = new window.JitsiMeetExternalAPI(jitsiDomain, {
        roomName,
        parentNode: containerRef.current,
        jwt: meetingAccess?.jwt,
        userInfo: {
          displayName: user?.full_name || 'Student',
          email: user?.email,
        },
        configOverwrite: {
          prejoinPageEnabled: false,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
        },
      });

      apiRef.current.addListener('videoConferenceLeft', () => {
        const canOpenFeedback =
          Boolean(booking?.status === 'completed') ||
          (sessionEndTime !== null && Date.now() >= sessionEndTime - 60_000);

        if (user?.role === 'student') {
          if (canOpenFeedback) {
            const bookingParam = booking?.id ? `&booking_id=${encodeURIComponent(booking.id)}` : '';
            navigate(`/student/dashboard?tab=feedback&feedback_popup=1${bookingParam}`);
            return;
          }
          navigate('/student/dashboard?tab=sessions');
          return;
        }
        navigate('/tutor/dashboard?tab=bookings');
      });

      // Safety: if tutor is moderator and lobby is enabled, disable it to prevent student waiting issues.
      if (meetingAccess?.is_moderator) {
        apiRef.current.addListener('lobbyEnabled', ((payload: unknown) => {
          const enabled = typeof payload === 'object' && payload !== null && 'enabled' in payload
            ? Boolean((payload as { enabled?: boolean }).enabled)
            : Boolean(payload);
          lobbyEnabled = enabled;
          if (enabled) {
            try {
              apiRef.current?.executeCommand('toggleLobby', false);
            } catch {
              // Ignore command failures; server-side policy may override.
            }
          }
        }) as () => void);

        apiRef.current.addListener('videoConferenceJoined', () => {
          if (!lobbyEnabled) return;
          try {
            apiRef.current?.executeCommand('toggleLobby', false);
          } catch {
            // Ignore command failures; server-side policy may override.
          }
        });
      }
    };

    const loadJitsiApi = () =>
      new Promise<void>((resolve, reject) => {
        if (window.JitsiMeetExternalAPI) {
          resolve();
          return;
        }

        const previous = document.getElementById('jitsi-external-api');
        if (previous) previous.remove();

        const script = document.createElement('script');
        script.id = 'jitsi-external-api';
        script.src = `https://${jitsiDomain}/external_api.js`;
        script.async = true;
        script.onload = () => {
          if (window.JitsiMeetExternalAPI) resolve();
          else reject(new Error('Jitsi API unavailable after script load'));
        };
        script.onerror = () => reject(new Error('Unable to load Jitsi script'));
        document.body.appendChild(script);
      });

    loadJitsiApi()
      .then(setupMeeting)
      .catch(() => {
        // One retry in case script load race occurred.
        setTimeout(() => {
          loadJitsiApi().then(setupMeeting).catch(() => {
            setError('Jitsi failed to load in embedded mode. You can still open the session in a new tab.');
          });
        }, 400);
      });

    return () => {
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, [booking, roomName, jitsiDomain, user?.email, user?.full_name, user?.role, navigate, meetingAccess?.jwt, meetingAccess?.is_moderator, sessionEndTime]);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading session...
        </div>
      </div>
    );
  }

  if (waitingForTutor) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white border border-amber-200 rounded-2xl p-6 shadow-sm text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <Loader2 className="w-6 h-6 text-amber-600 animate-spin" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Waiting for your tutor</h1>
          <p className="text-gray-600 mt-2">
            The session will open here automatically as soon as your tutor starts
            the meeting. You don't need to refresh this page.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 mt-0.5" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Unable to open session</h1>
              <p className="text-gray-600 mt-1">{error}</p>
              {appMeetingUrl && (
                <a
                  href={appMeetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Session in New Tab
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isTutorView = meetingAccess?.is_moderator === true;

  return (
    <div className="min-h-screen pt-20 bg-gray-950">
      <div className="px-4 sm:px-6 py-3 bg-gray-900 text-gray-100 text-sm flex items-center justify-between gap-3">
        <span className="truncate">
          {booking?.subject} session with {booking?.tutor_name || 'Tutor'}
        </span>
        {isTutorView && (
          <button
            type="button"
            onClick={handleRestartMeeting}
            disabled={restarting}
            title="If you lost moderator rights after a disconnect, click to rotate the room and reclaim control. Every participant will be moved into a fresh room."
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/90 hover:bg-amber-500 text-white text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {restarting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {restarting ? 'Resetting…' : 'Reclaim moderator'}
          </button>
        )}
      </div>
      <div ref={containerRef} className="w-full" style={{ height: 'calc(100vh - 84px)' }} />
    </div>
  );
};

export default MeetingRoom;
