import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User as UserIcon,
  HelpCircle,
  CheckCircle,
  FileText,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { askCivilMaintenanceAssistant } from '../services/gemini';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const AiAssistantDrawer: React.FC = () => {
  const {
    aiAssistantOpen,
    setAiAssistantOpen,
    attendance,
    worklogs,
    workers,
    locations,
  } = useApp();

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello! I am the **Civil Maintenance AI Assistant** for Bannari Amman Institute of Technology.\n\nI can provide factual queries on labour attendance, location-wise civil works, mason task histories, and today's manpower deployment based directly on our connected worklogs.\n\nTry clicking any of the quick queries below, or type your own question!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const quickPrompts = [
    'Show all mason work completed at Ruby Hostel this month.',
    'How many workers worked at Ganga Hostel yesterday?',
    'Prepare a summary of today\'s civil maintenance activities.',
    'Give me Bagavathi\'s work history.',
    'Show location-wise manpower deployment.',
    'What work was done in the Academic Block recently?',
  ];

  if (!aiAssistantOpen) return null;

  const handleSend = async (queryText?: string) => {
    const q = queryText || inputQuery;
    if (!q.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const answer = await askCivilMaintenanceAssistant(q.trim(), {
        attendance,
        worklogs,
        workers,
        locations,
      });

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `Error processing question: ${err.message || 'Unknown error'}. Please check your connection.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden no-print">
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={() => setAiAssistantOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md md:max-w-lg bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-indigo-600 flex items-center justify-center shadow-md">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>Civil Maintenance AI</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono font-medium">
                    Strict Grounding
                  </span>
                </h2>
                <p className="text-[11px] text-slate-300">Grounded exclusively on your worklog data</p>
              </div>
            </div>
            <button
              onClick={() => setAiAssistantOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Questions carousel */}
          <div className="p-3 bg-slate-50 border-b border-slate-200">
            <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-amber-600" /> Suggested Queries
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  disabled={loading}
                  className="text-[11px] text-left px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 text-slate-700 transition font-medium disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m) => {
              const isAi = m.sender === 'assistant';
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 text-xs leading-relaxed ${isAi ? 'items-start' : 'items-start flex-row-reverse'}`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center font-bold ${
                      isAi ? 'bg-indigo-600 text-white shadow-xs' : 'bg-amber-600 text-white'
                    }`}
                  >
                    {isAi ? <Bot className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-xs ${
                      isAi
                        ? 'bg-slate-100 text-slate-800 rounded-tl-xs border border-slate-200 whitespace-pre-wrap'
                        : 'bg-slate-900 text-white rounded-tr-xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    <div
                      className={`text-[9px] mt-1.5 flex items-center gap-1 ${
                        isAi ? 'text-slate-400' : 'text-slate-400 justify-end'
                      }`}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      {m.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-3 text-xs items-center text-slate-500">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Bot className="w-4 h-4 animate-bounce" />
                </div>
                <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-2 rounded-xl">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                  <span>Inspecting worklogs and computing summary...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Footer */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask about workers, locations, daily wages, mason tasks..."
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim() || loading}
                className="p-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition disabled:opacity-50 shrink-0 shadow-md shadow-amber-600/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="text-[10px] text-slate-400 text-center mt-2">
              Department of Civil Maintenance • Bannari Amman Institute of Technology
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
