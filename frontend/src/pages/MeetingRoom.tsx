import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { bookingsAPI, type BookingResponse, type MeetingAccessResponse } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { isMeetingExpired } from '../utils/jitsiMeeting';

type JitsiParticipantInfo = {
  participantId?: string;
  displayName?: string;
  email?: string;
  role?: string;
};

type JitsiApiInstance = {
  addListener: (event: string, callback: (...args: unknown[]) => void) => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
  getParticipantsInfo?: () => JitsiParticipantInfo[];
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

      // Moderator hand-back: on meet.jit.si the JWT moderator claim is
      // only advisory, so if the tutor drops off the call and reconnects
      // Jitsi leaves them as a regular participant (whoever took over
      // — usually a student — keeps the admin rights). We paper over
      // that by having every client watch for the tutor joining (by
      // email match) and calling `grantModerator` on them. The grant
      // only succeeds when issued by the current moderator, so whichever
      // client happens to hold that role at the moment the tutor
      // rejoins will hand it back automatically. Tutors on JaaS get
      // moderator enforced server-side, so this is a no-op there.
      const tutorEmail = (meetingAccess?.tutor_email || '').trim().toLowerCase();

      const isTutorParticipant = (info: JitsiParticipantInfo | undefined): boolean => {
        if (!info || !tutorEmail) return false;
        return (info.email || '').trim().toLowerCase() === tutorEmail;
      };

      const findParticipantById = (id: string): JitsiParticipantInfo | undefined => {
        try {
          const list = apiRef.current?.getParticipantsInfo?.() || [];
          return list.find((p) => p.participantId === id);
        } catch {
          return undefined;
        }
      };

      const promoteIfTutor = (participantId: string, attempt = 0) => {
        const info = findParticipantById(participantId);
        // `participantJoined` can fire before the participant's email
        // metadata has propagated. Retry a few times before giving up.
        if (!info || !info.email) {
          if (attempt < 5) {
            setTimeout(() => promoteIfTutor(participantId, attempt + 1), 600);
          }
          return;
        }
        if (!isTutorParticipant(info)) return;
        if ((info.role || '').toLowerCase() === 'moderator') return;
        try {
          apiRef.current?.executeCommand('grantModerator', participantId);
        } catch {
          // Silently ignore — only the current moderator can grant;
          // the other non-moderator clients will no-op here.
        }
      };

      if (tutorEmail) {
        apiRef.current.addListener('participantJoined', (...args: unknown[]) => {
          const payload = args[0] as { id?: string } | undefined;
          if (payload?.id) {
            // Small delay so the server has registered the new participant
            // before we try to grant — grantModerator is a no-op on
            // unknown ids.
            setTimeout(() => promoteIfTutor(payload.id as string), 400);
          }
        });

        apiRef.current.addListener('participantRoleChanged', (...args: unknown[]) => {
          const payload = args[0] as { id?: string; role?: string } | undefined;
          if (!payload?.id) return;
          if ((payload.role || '').toLowerCase() === 'moderator') return;
          // Tutor was downgraded (or is still a regular participant).
          // Try to promote them again; if we're the current moderator
          // this succeeds, otherwise it's silently ignored.
          promoteIfTutor(payload.id);
        });
      }

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
  }, [booking, roomName, jitsiDomain, user?.email, user?.full_name, user?.role, navigate, meetingAccess?.jwt, meetingAccess?.tutor_email, meetingAccess?.is_moderator, sessionEndTime]);

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

  return (
    <div className="min-h-screen pt-20 bg-gray-950">
      <div className="px-4 sm:px-6 py-3 bg-gray-900 text-gray-100 text-sm">
        {booking?.subject} session with {booking?.tutor_name || 'Tutor'}
      </div>
      <div ref={containerRef} className="w-full" style={{ height: 'calc(100vh - 84px)' }} />
    </div>
  );
};

export default MeetingRoom;
