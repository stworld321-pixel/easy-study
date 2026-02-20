import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { messagesAPI } from '../services/api';
import type { ConversationResponse, ChatMessageResponse } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface ChatInboxProps {
  mode: 'student' | 'tutor' | 'admin';
  initialTutorUserId?: string | null;
}

const ChatInbox: React.FC<ChatInboxProps> = ({ mode, initialTutorUserId }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [messageText, setMessageText] = useState('');
  const [search, setSearch] = useState('');

  const selectedConversation = useMemo(
    () => conversations.find(c => c.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const refreshConversations = async () => {
    if (mode === 'admin') {
      const rows = await messagesAPI.adminGetConversations(search || undefined);
      setConversations(rows);
      return rows;
    }
    const rows = await messagesAPI.getConversations();
    setConversations(rows);
    return rows;
  };

  const refreshMessages = async (conversationId: string) => {
    const rows = mode === 'admin'
      ? await messagesAPI.adminGetMessages(conversationId)
      : await messagesAPI.getMessages(conversationId);
    setMessages(rows);
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        if (mode === 'student' && initialTutorUserId) {
          const started = await messagesAPI.startConversation(initialTutorUserId);
          const rows = await refreshConversations();
          setSelectedConversationId(started.id || rows?.[0]?.id || null);
        } else {
          const rows = await refreshConversations();
          if (rows?.length) {
            setSelectedConversationId(rows[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, initialTutorUserId]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }
    refreshMessages(selectedConversationId).catch((error) => {
      console.error('Failed to load messages:', error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId, mode]);

  const handleSend = async () => {
    if (mode === 'admin' || !selectedConversationId || !messageText.trim()) return;
    try {
      await messagesAPI.sendMessage(selectedConversationId, messageText.trim());
      setMessageText('');
      await refreshMessages(selectedConversationId);
      await refreshConversations();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="grid md:grid-cols-3 min-h-[520px]">
        <div className="md:col-span-1 border-r border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Conversations</h3>
            {mode === 'admin' && (
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student/tutor..."
                className="w-full mt-3 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            )}
          </div>
          <div className="max-h-[460px] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-gray-500">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">No conversations yet</div>
            ) : (
              conversations.map((c) => {
                const title = mode === 'student' ? c.tutor_name : c.student_name;
                const subtitle = mode === 'admin' ? `${c.student_name} ↔ ${c.tutor_name}` : (c.last_message_preview || 'No messages yet');
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedConversationId(c.id)}
                    className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${selectedConversationId === c.id ? 'bg-primary-50' : ''}`}
                  >
                    <div className="font-medium text-gray-900">{title}</div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">{subtitle}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              {selectedConversation
                ? (mode === 'student' ? selectedConversation.tutor_name : mode === 'tutor' ? selectedConversation.student_name : `${selectedConversation.student_name} ↔ ${selectedConversation.tutor_name}`)
                : 'Select a conversation'}
            </h3>
          </div>

          <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[380px] bg-gray-50/30">
            {!selectedConversationId ? (
              <div className="text-sm text-gray-500">Choose a conversation to view messages.</div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-gray-500">No messages yet. Start the conversation.</div>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${mine ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                      <div className="text-[11px] opacity-80 mb-1">{m.sender_name}</div>
                      <div>{m.content}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-4 border-t border-gray-100">
            {mode === 'admin' ? (
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Admin monitoring mode (read-only)
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSend();
                  }}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={!selectedConversationId}
                />
                <button
                  onClick={handleSend}
                  disabled={!selectedConversationId || !messageText.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInbox;
