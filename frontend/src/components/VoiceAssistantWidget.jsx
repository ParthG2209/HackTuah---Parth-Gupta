import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, X, Volume2, Loader, Bot } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import MarkdownRenderer from './MarkdownRenderer';

// Material Symbol Robot Icon Component
function Robot3DAvatar({ size = 28, isListening = false, isSpeaking = false }) {
  const color = isListening ? '#ef4444' : isSpeaking ? '#a855f7' : '#c084fc';
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: `${size}px`,
        color: color,
        userSelect: 'none',
        fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'color 0.2s ease'
      }}
    >
      robot_2
    </span>
  );
}

export default function VoiceAssistantWidget({ sessionId = null, onCommand = null }) {
  const { profile, API_BASE } = useAuth();
  const [activeSessId, setActiveSessId] = useState(sessionId);
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState(() => {
    const defaultGreeting = { role: 'assistant', content: 'I am KAIROS Chatbot. Ask me anything, or speak commands like *"Mark setup task as completed"* or *"Summarize blockers"*.' };
    try {
      const saved = localStorage.getItem('kairos_widget_chat_history');
      if (saved) {
        let parsed = JSON.parse(saved);
        parsed = parsed.map(m => {
          if (m.role === 'assistant' && typeof m.content === 'string') {
            return {
              ...m,
              content: m.content
                .replace(/👋\s*/g, '')
                .replace(/^Hi!\s*/gi, '')
                .replace(/3D Robot Assistant/gi, 'Chatbot')
            };
          }
          return m;
        });
        return parsed;
      }
      return [defaultGreeting];
    } catch (e) {
      return [defaultGreeting];
    }
  });

  // Save chat history to localStorage whenever messages change
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem('kairos_widget_chat_history', JSON.stringify(messages));
      }
    } catch (e) {}
  }, [messages]);
  const [isLoading, setIsLoading] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  // Auto-fetch or auto-create active session if not explicitly passed
  useEffect(() => {
    let isMounted = true;
    const resolveSession = async () => {
      if (sessionId) {
        if (isMounted) setActiveSessId(sessionId);
        return;
      }
      try {
        let profId = profile?.id;
        if (!profId) {
          const savedUser = localStorage.getItem('kairos_user');
          if (savedUser) {
            const u = JSON.parse(savedUser);
            profId = u.profile_id || u.id;
          }
        }
        if (profId) {
          const res = await axios.get(`${API_BASE}/sessions`, { params: { profile_id: profId } });
          if (res.data && res.data.length > 0) {
            if (isMounted) setActiveSessId(res.data[0].id);
          }
        }
      } catch (err) {
        console.error("Widget session resolve error:", err);
      }
    };
    resolveSession();
    return () => { isMounted = false; };
  }, [sessionId, profile?.id, API_BASE]);

  const lastTranscriptRef = useRef('');

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
        setInputText(currentTranscript);
        lastTranscriptRef.current = currentTranscript;
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (lastTranscriptRef.current && lastTranscriptRef.current.trim()) {
          const autoSendText = lastTranscriptRef.current;
          lastTranscriptRef.current = '';
          handleSend(autoSendText);
        }
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }
  }, [activeSessId, sessionId]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        if (audioBlob.size < 500) return;

        setIsLoading(true);
        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'voice.webm');

          const res = await axios.post(`${API_BASE}/voice/transcribe`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          if (res.data && res.data.text) {
            const transcribedText = res.data.text.trim();
            setTranscript(transcribedText);
            setInputText(transcribedText);
            handleSend(transcribedText);
          }
        } catch (err) {
          console.error("Groq Whisper API transcription error:", err);
        } finally {
          setIsLoading(false);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsListening(true);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Could not access microphone. Please check browser permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopRecording();
    } else {
      setTranscript('');
      startRecording();
    }
  };

  const handleSend = async (textToSend = inputText) => {
    const query = textToSend.trim();
    if (!query) return;

    const userMsg = { role: 'user', content: query };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setTranscript('');
    setIsLoading(true);

    if (onCommand) {
      onCommand(query);
    }

    let targetSessionId = activeSessId || sessionId;

    if (!targetSessionId) {
      try {
        let profId = profile?.id;
        if (!profId) {
          const savedUser = localStorage.getItem('kairos_user');
          if (savedUser) {
            const u = JSON.parse(savedUser);
            profId = u.profile_id || u.id;
          }
        }
        if (profId) {
          const res = await axios.get(`${API_BASE}/sessions`, { params: { profile_id: profId } });
          if (res.data && res.data.length > 0) {
            targetSessionId = res.data[0].id;
            setActiveSessId(targetSessionId);
          } else {
            setMessages(prev => [...prev, { role: 'assistant', text: "Please create a project from the dashboard first to start chatting!" }]);
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error("Dynamic session creation in handleSend error:", err);
      }
    }

    // Direct Voice & Text Task Status Auto-Update Engine
    const lowerQuery = query.toLowerCase();
    let targetStatus = null;
    if (lowerQuery.includes('pending') || lowerQuery.includes('reset') || lowerQuery.includes('uncheck') || lowerQuery.includes('todo')) {
      targetStatus = 'pending';
    } else if (lowerQuery.includes('progress') || lowerQuery.includes('working')) {
      targetStatus = 'in_progress';
    } else if (lowerQuery.includes('block') || lowerQuery.includes('stuck')) {
      targetStatus = 'blocked';
    } else if (lowerQuery.includes('done') || lowerQuery.includes('complete') || lowerQuery.includes('completed') || lowerQuery.includes('finish')) {
      targetStatus = 'completed';
    }

    if (targetStatus && targetSessionId) {
      try {
        const tasksRes = await axios.get(`${API_BASE}/sessions/${targetSessionId}/tasks`);
        const sessionTasks = tasksRes.data || [];
        
        const filler = ['mark', 'as', 'completed', 'complete', 'done', 'finish', 'task', 'to', 'in', 'progress', 'blocked', 'status', 'the', 'a', 'set', 'is'];
        const queryWords = lowerQuery.split(/\s+/).filter(w => !filler.includes(w) && w.length > 2);
        const cleanQuery = lowerQuery.replace(/mark|as|completed|complete|done|finish|task/g, '').trim();

        let bestTask = null;
        let maxScore = 0;

        for (const t of sessionTasks) {
          const tNameLower = t.name.toLowerCase();
          
          if (cleanQuery && (tNameLower.includes(cleanQuery) || cleanQuery.includes(tNameLower))) {
            bestTask = t;
            break;
          }

          const tWords = tNameLower.split(/\s+/);
          const score = queryWords.filter(w => tWords.some(tw => tw.includes(w) || w.includes(tw))).length;
          if (score > maxScore) {
            maxScore = score;
            bestTask = t;
          }
        }

        const matchedTask = bestTask || (sessionTasks.find(t => t.status !== targetStatus) || sessionTasks[0]);

        if (matchedTask) {
          await axios.put(`${API_BASE}/tasks/${matchedTask.id}`, { status: targetStatus });
          // Dispatch global event so Dashboard, Tasks board, and Coach flowchart sync real-time!
          window.dispatchEvent(new CustomEvent('kairos:task_updated', { detail: { taskId: matchedTask.id, status: targetStatus } }));
        }
      } catch (err) {
        console.error("Auto task status update error from Voice Bot:", err);
      }
    }

    try {
      if (targetSessionId) {
        const history = messages.map(m => ({ role: m.role, content: m.content }));
        history.push(userMsg);

        const response = await fetch(`${API_BASE}/sessions/${targetSessionId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: query,
            history: history,
            model_preference: 'deepseek'
          })
        });

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          let botResponse = '';
          
          setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data:')) {
                try {
                  const payload = JSON.parse(line.substring(5).trim());
                  if (payload.type === 'text_delta') {
                    botResponse += payload.content;
                    setMessages(prev => {
                      const updated = [...prev];
                      updated[updated.length - 1] = { role: 'assistant', content: botResponse };
                      return updated;
                    });
                  }
                } catch (e) {}
              }
            }
          }
          // Dispatch global task update event so all pages (Dashboard, Tasks, Coach) sync real-time
          window.dispatchEvent(new CustomEvent('kairos:task_updated'));
        }
      } else {
        setTimeout(() => {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: "**No Active Session Found**: Please create or open a coaching session first so I can analyze your specific project tasks and blockers." 
          }]);
        }, 400);
      }
    } catch (err) {
      console.error('Widget voice chat error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Could not process request. Please check backend connection.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '28px', right: '28px', zIndex: 99999 }}>
      <style>{`
        @keyframes subtleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
      
      {/* Floating Toggle Button with Minimal Clean Avatar */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '30px',
            background: '#18181b',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            animation: 'subtleFloat 4s ease-in-out infinite',
            transition: 'transform 0.2s ease, border-color 0.2s ease'
          }}
          className="voice-widget-btn"
          title="Open Kairos Assistant"
        >
          <Robot3DAvatar size={32} isListening={isListening} isSpeaking={isLoading} />
        </button>
      )}

      {/* Popover Assistant Window */}
      {isOpen && (
        <div style={{
          width: '380px',
          height: '520px',
          background: 'rgba(15, 13, 24, 0.97)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'widgetPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Robot3DAvatar size={24} isListening={isListening} isSpeaking={isLoading} />
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>KAIROS Chatbot</h4>
                <span style={{ fontSize: '10px', color: '#00FF66', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00FF66', display: 'inline-block' }} /> Voice & Chat Active
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Chat Messages Container */}
          <div style={{
            flexGrow: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: m.role === 'user' ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(99, 102, 241, 0.3))' : 'rgba(255, 255, 255, 0.05)',
                  border: m.role === 'user' ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '10px 14px',
                  borderRadius: '0px',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  color: '#fff'
                }}
              >
                <MarkdownRenderer content={(m.content || '').replace(/👋\s*/g, '').replace(/^Hi!\s*/gi, '')} />
              </div>
            ))}

            {isListening && (
              <div style={{
                alignSelf: 'center',
                padding: '8px 16px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '0px',
                color: '#f87171',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                animation: 'pulse 1.5s infinite'
              }}>
                <Volume2 size={14} /> Listening... {transcript ? `"${transcript}"` : 'Speak now'}
              </div>
            )}

            {isLoading && (
              <div style={{ alignSelf: 'flex-start', padding: '8px 12px', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Kairos is analyzing tasks...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Action Chips */}
          <div style={{
            padding: '6px 12px',
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            borderTop: '1px solid rgba(255, 255, 255, 0.04)',
            background: 'rgba(0,0,0,0.2)'
          }}>
            <button
              onClick={() => handleSend("Summarize our current blockers")}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0px',
                padding: '4px 10px',
                color: '#d1d5db',
                fontSize: '10px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Blockers Summary
            </button>
            <button
              onClick={() => handleSend("Mark task as completed")}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0px',
                padding: '4px 10px',
                color: '#d1d5db',
                fontSize: '10px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Mark Task Done
            </button>
            <button
              onClick={() => handleSend("What should I work on next?")}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0px',
                padding: '4px 10px',
                color: '#d1d5db',
                fontSize: '10px',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Next Priority
            </button>
          </div>

          {/* Input Footer */}
          <div style={{
            padding: '12px',
            background: 'rgba(0, 0, 0, 0.4)',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <button
              onClick={toggleListening}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '0px',
                background: isListening ? '#ef4444' : 'rgba(255, 255, 255, 0.08)',
                border: isListening ? '1px solid #f87171' : '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0
              }}
              title={isListening ? 'Stop listening' : 'Start voice command'}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <input
              type="text"
              className="form-input"
              style={{
                flexGrow: 1,
                fontSize: '12px',
                padding: '8px 12px',
                borderRadius: '0px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff'
              }}
              placeholder={isListening ? 'Listening...' : 'Type or speak command...'}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />

            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim() || isLoading}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '0px',
                background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: inputText.trim() ? 'pointer' : 'default',
                opacity: inputText.trim() ? 1 : 0.5,
                flexShrink: 0
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
