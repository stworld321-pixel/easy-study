import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { bookingsAPI, type BookingResponse, type MeetingAccessResponse } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { isMeetingExpired } from '../utils/jitsiMeeting';

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => {
      addListener: (event: string, callback: () => void) => void;
      executeCommand: (command: string, ...args: unknown[]) => void;
      dispose: () => void;
    };
  }
}

type JitsiApiInstance = {
  addListener: (event: string, callback: () => void) => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
  dispose: () => void;
};

const MeetingRoom: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [meetingAccess, setMeetingAccess] = useState<MeetingAccessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const meetingUrl = useMemo(() => {
    if (meetingAccess?.launch_url) return meetingAccess.launch_url;
    if (meetingAccess?.meeting_url) return meetingAccess.meeting_url;
    return roomName ? `https://${jitsiDomain}/${roomName}` : '';
  }, [meetingAccess?.launch_url, meetingAccess?.meeting_url, roomName, jitsiDomain]);

  useEffect(() => {
    const fetchBooking = async () => {
      if (!bookingId) {
        setError('Invalid booking link.');
        setLoading(false);
        return;
      }
      try {
        const [data, access] = await Promise.all([
          bookingsAPI.getById(bookingId),
          bookingsAPI.getMeetingAccess(bookingId),
        ]);
        if (data.status !== 'confirmed') {
          setError('This session is not confirmed yet.');
        } else if (isMeetingExpired(data)) {
          setError('This session link has expired.');
        } else {
          setBooking(data);
          setMeetingAccess(access);
        }
      } catch (err: unknown) {
        const apiError = err as {
          response?: { data?: { detail?: string; message?: string } };
          message?: string;
        };
        const detail =
          apiError?.response?.data?.detail ||
          apiError?.response?.data?.message ||
          apiError?.message ||
          'Unable to load this session.';
        setError(detail);
      } finally {
        setLoading(false);
      }
    };
    fetchBooking();
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
        if (user?.role === 'student') {
          const bookingParam = booking?.id ? `&booking_id=${encodeURIComponent(booking.id)}` : '';
          navigate(`/student/dashboard?tab=feedback&feedback_popup=1${bookingParam}`);
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
  }, [booking, roomName, jitsiDomain, user?.email, user?.full_name, user?.role, navigate, meetingAccess?.jwt]);

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

  if (error) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white border border-red-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 mt-0.5" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Unable to open session</h1>
              <p className="text-gray-600 mt-1">{error}</p>
              {meetingUrl && (
                <a
                  href={meetingUrl}
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
