import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Plus, Send, Check, Trash2, Calendar, FileText, Download, User, ArrowLeft, Loader } from 'lucide-react';
import RoadmapFlowchart from '../components/RoadmapFlowchart';
import MarkdownRenderer from '../components/MarkdownRenderer';
import VoiceAssistantWidget from '../components/VoiceAssistantWidget';
import SessionCard from '../components/SessionCard';
export default function Coach() {
  const { profile, API_BASE } = useAuth();
  
  // Navigation View: 'sessions' | 'create' | 'workspace'
  const [view, setView] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  
  // Forms state
  const [hackathonName, setHackathonName] = useState('');
  const [isTeam, setIsTeam] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [myTeams, setMyTeams] = useState([]);
  const [probText, setProbText] = useState('');
  const [probFile, setProbFile] = useState(null);
  const [userIdea, setUserIdea] = useState('');
  const [modelPref, setModelPref] = useState('deepseek');

  // Interactive Workspace State
  const [critique, setCritique] = useState('');
  const [roadmap, setRoadmap] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [tasks, setTasks] = useState([]);
  const [blockers, setBlockers] = useState([]);
  const [toast, setToast] = useState(null); // { message: '', type: 'success' | 'error' }

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };


  const fetchSessionTasksAndBlockers = async (sessionId) => {
    if (!sessionId) return;
    try {
      const tasksRes = await axios.get(`${API_BASE}/sessions/${sessionId}/tasks`);
      setTasks(tasksRes.data);
      const blockersRes = await axios.get(`${API_BASE}/sessions/${sessionId}/blockers`);
      setBlockers(blockersRes.data);
    } catch (e) {
      console.error("Error fetching tasks and blockers for flowchart:", e);
    }
  };

  useEffect(() => {
    if (activeSession) {
      fetchSessionTasksAndBlockers(activeSession.id);
    }
  }, [activeSession?.id]);

  const chatEndRef = useRef(null);

  const fetchSessions = async () => {
    if (!profile) return;
    try {
      const res = await axios.get(`${API_BASE}/sessions`, {
        params: { profile_id: profile.id }
      });
      setSessions(res.data);
    } catch (e) {
      console.error("Error loading sessions:", e);
    }
  };

  const fetchMyTeams = async () => {
    if (!profile) return;
    try {
      const res = await axios.get(`${API_BASE}/teams/user/${profile.id}`);
      setMyTeams(res.data);
      if (res.data.length > 0) {
        setSelectedTeamId(res.data[0].id);
      }
    } catch (e) {
      console.error("Error fetching user teams:", e);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchMyTeams();
  }, [profile]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, critique]);

  const handleStartNewSession = () => {
    setView('create');
  };

  const selectSession = async (sess) => {
    setActiveSession(sess);
    setRoadmap(sess.milestones || []);
    setCritique(sess.scope_critique || '');
    // Seed initial message if milestones exist
    setMessages([
      { role: 'assistant', content: `Welcome back to KAIROS Coach Room! Here is your generated roadmap. Let me know if you would like to edit or adjust any milestones.` }
    ]);
    setView('workspace');
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await axios.delete(`${API_BASE}/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      showToast("Session deleted successfully!", "success");
    } catch (e) {
      console.error("Error deleting session:", e);
      showToast("Failed to delete session.", "error");
    }
  };

  const handleFileChange = (e) => {
    setProbFile(e.target.files[0]);
  };

  const handleCreateSessionSubmit = async (e) => {
    e.preventDefault();
    if (!hackathonName.trim()) return;

    try {
      // 1. Initialize session on backend
      const res = await axios.post(`${API_BASE}/sessions`, {
        name: hackathonName,
        creator_id: profile.id,
        team_id: isTeam ? selectedTeamId : null
      });
      const session = res.data;
      setActiveSession(session);
      setView('workspace');
      setIsGenerating(true);
      setCritique('');
      setRoadmap([]);
      setMessages([
        { role: 'assistant', content: `Hello! I'm KAIROS, your AI Coach. I'm currently analyzing your project idea to draft a roadmap and scope critique. Once it's ready, we can refine it together.` }
      ]);

      // 2. Build form data for streaming concept analysis
      const formData = new FormData();
      formData.append("user_idea", userIdea);
      formData.append("problem_statement_text", probText);
      formData.append("model_preference", modelPref);
      if (probFile) {
        formData.append("problem_statement_file", probFile);
      }

      setGenerationStep("Critiquing project scope...");
      
      // 3. Trigger streaming request
      const response = await fetch(`${API_BASE}/sessions/${session.id}/concept`, {
        method: 'POST',
        body: formData
      });

      if (!response.body) {
        throw new Error("ReadableStream not supported on response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let buffer = '';
      let rawText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Save the last incomplete line back to buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const payload = JSON.parse(line.substring(5).trim());
              if (payload.type === 'text_delta') {
                rawText += payload.content;
                setCritique(rawText);
              } else if (payload.type === 'system_info') {
                setGenerationStep(payload.content);
              }
            } catch (err) {
              // Ignore partial chunk parse failures
            }
          }
        }
      }

      // Finish up, parse out JSON if outputted
      setIsGenerating(false);

      // Extract JSON using a robust multi-fallback mechanism
      const extractRoadmapJSON = (text) => {
        const lowerText = text.toLowerCase();
        let startIdx = lowerText.indexOf('roadmap_json_start');
        let endIdx = lowerText.indexOf('roadmap_json_end');

        let jsonStr = '';
        let critiqueText = text;

        if (startIdx !== -1) {
          const actualStart = text.indexOf(']', startIdx) + 1;
          const actualEnd = endIdx !== -1 ? text.lastIndexOf('[', endIdx) : text.length;
          jsonStr = text.substring(actualStart, actualEnd).trim();
          
          const bracketIdx = text.lastIndexOf('[', startIdx);
          critiqueText = text.substring(0, bracketIdx !== -1 ? bracketIdx : startIdx).trim();
        } else {
          // Fallback 1: Try to find ```json ... ``` block
          const matchBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (matchBlock) {
            jsonStr = matchBlock[1].trim();
            critiqueText = text.split(/```/)[0].trim();
          } else {
            // Fallback 2: Look for the first '[' and last ']'
            const firstBracket = text.indexOf('[');
            const lastBracket = text.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
              jsonStr = text.substring(firstBracket, lastBracket + 1).trim();
              critiqueText = text.substring(0, firstBracket).trim();
            }
          }
        }

        // Clean trailing separator
        critiqueText = critiqueText.replace(/\n\s*---\s*$/, '').trim();

        // Clean any residual markdown ticks in the JSON string
        jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

        // If the json string has a think block, strip it
        if (jsonStr.includes('</think>')) {
          jsonStr = jsonStr.split('</think>').pop().trim();
        }

        try {
          return {
            roadmap: JSON.parse(jsonStr),
            critique: critiqueText
          };
        } catch (jsonErr) {
          // Attempt trailing comma cleanup
          try {
            const cleanedJson = jsonStr.replace(/,\s*([\]}])/g, '$1').trim();
            return {
              roadmap: JSON.parse(cleanedJson),
              critique: critiqueText
            };
          } catch (jsonErr2) {
            console.error("All roadmap JSON extraction methods failed. Raw JSON string was:", jsonStr);
            return null;
          }
        }
      };

      const extracted = extractRoadmapJSON(rawText);
      if (extracted && Array.isArray(extracted.roadmap)) {
        setCritique(extracted.critique);
        setRoadmap(extracted.roadmap);
        try {
          // Auto-save milestones to backend DB
          const updateRes = await axios.put(`${API_BASE}/sessions/${session.id}/roadmap`, {
            milestones: extracted.roadmap,
            scope_critique: extracted.critique
          });
          setActiveSession(updateRes.data);
        } catch (dbErr) {
          console.error("Error auto-saving roadmap to DB:", dbErr);
        }
      } else {
        // Fallback: If JSON parsing completely failed, display everything as critique
        setCritique(rawText);
      }

      // Refresh list of sessions in background
      fetchSessions();

    } catch (err) {
      console.error("Error creating session:", err);
      setIsGenerating(false);
      showToast("Failed to initialize session. Make sure backend is running.", "error");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeSession) return;

    const userMsg = { role: 'user', content: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    
    // Create payload history
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    history.push(userMsg);

    try {
      setIsGenerating(true);
      setGenerationStep("Coach is thinking...");
      
      const response = await fetch(`${API_BASE}/sessions/${activeSession.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          history: history,
          model_preference: modelPref
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        setMessages(prev => [...prev, { role: 'assistant', content: `Backend error (${response.status}): ${errText || 'Failed to connect to Coach API.'}` }]);
        setIsGenerating(false);
        return;
      }

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      let buffer = '';
      let botResponse = '';
      const assistantMsg = { role: 'assistant', content: '' };
      setMessages(prev => [...prev, assistantMsg]);

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
              } else if (payload.type === 'error') {
                botResponse += `\n[ERROR] ${payload.content}`;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: botResponse };
                  return updated;
                });
              }
            } catch (err) {}
          }
        }
      }
      setIsGenerating(false);

    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Network error. Please check your internet or backend status." }]);
      setIsGenerating(false);
    }
  };

  const handleAcceptRoadmap = async () => {
    if (!activeSession) return;
    try {
      const res = await axios.put(`${API_BASE}/sessions/${activeSession.id}/roadmap`, {
        milestones: roadmap,
        status: 'execution',
        scope_critique: critique
      });
      setActiveSession(res.data);
      setSessions(prev => prev.map(s => s.id === res.data.id ? res.data : s));
      window.dispatchEvent(new CustomEvent('kairos:task_updated'));
      fetchSessions();
      showToast("Roadmap successfully locked! Tasks generated on your Task Board.", "success");
    } catch (e) {
      console.error("Error accepting roadmap:", e);
      showToast("Failed to lock roadmap.", "error");
    }
  };

  const handleDownloadProjectPDF = async () => {
    if (!activeSession) return;
    try {
      showToast("Generating Executive Project PDF...", "info");
      const response = await axios.get(`${API_BASE}/sessions/${activeSession.id}/pitch/export-pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${activeSession.name.replace(/\s+/g, '_')}_Blueprint.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast("Executive PDF Blueprint downloaded successfully!", "success");
    } catch (e) {
      console.error("PDF Export error:", e);
      showToast("Failed to download PDF report.", "error");
    }
  };

  const handleDownloadRoadmap = (format) => {
    if (!activeSession) return;
    let content = `# KAIROS Project Roadmap: ${activeSession.name}\n\n`;
    roadmap.forEach(m => {
      content += `## ${m.phase}: ${m.title}\n`;
      content += `- Deliverable: ${m.deliverable}\n`;
      content += `- Duration: ${m.duration_estimate}\n`;
      content += `- Risk: ${(m.risk_level || 'medium').toUpperCase()}\n\n`;
    });

    if (format === 'md') {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roadmap_${activeSession.name}.md`;
      a.click();
    } else {
      window.print();
    }
  };

  const handleMilestoneEdit = (idx, field, val) => {
    // Only creator/leader can edit
    if (activeSession.creator_id !== profile.id) return;
    const updated = [...roadmap];
    updated[idx][field] = val;
    setRoadmap(updated);
  };

  const handleDeleteMilestone = (idx) => {
    if (activeSession.creator_id !== profile.id) return;
    setRoadmap(roadmap.filter((_, i) => i !== idx));
  };

  const handleAddMilestone = () => {
    if (activeSession.creator_id !== profile.id) return;
    setRoadmap([
      ...roadmap,
      { phase: `Phase ${roadmap.length + 1}`, title: 'New Phase', deliverable: 'TBD', duration_estimate: '4 hours', dependencies: [], risk_level: 'low' }
    ]);
  };

  return (
    <div className="main-content">
      {view === 'sessions' && (
        <>
          <div className="dashboard-header">
            <div>
              <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#fff' }}>AI Coach Rooms</h1>
              <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px' }}>
                Join an active coaching session or establish a new roadmap.
              </p>
            </div>
            <button onClick={handleStartNewSession} className="btn btn-primary">
              <Plus size={16} /> New Coaching Session
            </button>
          </div>

          <div className="dashboard-grid">
            {sessions.length === 0 ? (
              <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px' }}>
                <MessageSquare size={48} style={{ color: '#6b7280', marginBottom: '16px' }} />
                <p style={{ color: '#9ca3af' }}>No coaching sessions set up. Click "New Coaching Session" above to start.</p>
              </div>
            ) : (
              sessions.map(s => (
                <SessionCard 
                  key={s.id} 
                  session={s} 
                  onDelete={handleDeleteSession} 
                  onClick={selectSession} 
                  teams={myTeams} 
                />
              ))
            )}
          </div>
        </>
      )}

      {view === 'create' && (
        <>
          <div className="dashboard-header">
            <button onClick={() => setView('sessions')} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
              <ArrowLeft size={16} /> Back
            </button>
          </div>

          <div className="glass-card" style={{ maxWidth: '700px', margin: '0 auto', width: '100%' }}>
            <h2 style={{ fontSize: '28px', color: '#fff', marginBottom: '24px' }}>Start Coaching Session</h2>
            
            <form onSubmit={handleCreateSessionSubmit}>
              <div className="form-group">
                <label className="form-label">Hackathon & Project Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. HackMIT - Kairos Auth"
                  value={hackathonName}
                  onChange={(e) => setHackathonName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Coaching Mode</label>
                <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" checked={!isTeam} onChange={() => setIsTeam(false)} /> Solo Mode
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" checked={isTeam} onChange={() => setIsTeam(true)} /> Team Mode
                  </label>
                </div>
              </div>

              {isTeam && (
                <div className="form-group">
                  <label className="form-label">Select Your Team</label>
                  <select className="form-select" value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
                    {myTeams.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                    ))}
                  </select>
                </div>
              )}



              <div className="form-group">
                <label className="form-label">Problem Statement File (PDF / Docx)</label>
                <input type="file" accept=".pdf,.docx,.txt" onChange={handleFileChange} />
              </div>

              <div className="form-group">
                <label className="form-label">Or paste Problem Statement Text</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Paste problem statement details..."
                  value={probText}
                  onChange={(e) => setProbText(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Your Project Idea</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="What is your idea? Explain what you plan to build..."
                  value={userIdea}
                  onChange={(e) => setUserIdea(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '24px' }}>
                Launch Coach Pipeline
              </button>
            </form>
          </div>
        </>
      )}

      {view === 'workspace' && activeSession && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="dashboard-header" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button onClick={() => setView('sessions')} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
                <ArrowLeft size={16} /> Leave Room
              </button>
              <h2 style={{ fontSize: '24px', color: '#fff' }}>{activeSession.name} Coach</h2>
            </div>
            {roadmap.length > 0 && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={handleDownloadProjectPDF} className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                  <Download size={14} /> Export Project PDF
                </button>
                <button onClick={() => handleDownloadRoadmap('md')} className="btn btn-secondary">
                  <Download size={14} /> Export MD
                </button>
                {activeSession.creator_id === profile.id && activeSession.status === 'planning' && (
                  <button onClick={handleAcceptRoadmap} className="btn btn-primary">
                    <Check size={14} /> Lock Roadmap & Generate Tasks
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Left-Right Split Layout: Timeline on Left, Critique & Chat stacked on Right */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '12px', flexGrow: 1, minHeight: 'calc(100vh - 180px)', height: 'calc(100vh - 180px)' }}>
            
            {/* Left Column: Vertical Timeline / Loader */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '20px', height: '100%', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', color: '#fff', margin: 0 }}>Interactive Roadmap Flowchart</h3>
                {activeSession.creator_id === profile.id && activeSession.status === 'planning' && roadmap.length > 0 && (
                  <button onClick={handleAddMilestone} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                    + Add Phase
                  </button>
                )}
              </div>

              <div style={{ flexGrow: 1, position: 'relative', height: 'calc(100% - 45px)' }}>
                {isGenerating && roadmap.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', gap: '16px', background: 'rgba(8,9,12,0.4)' }}>
                    <Loader className="spin" size={36} style={{ color: '#8b5cf6', animation: 'spinSlow 2s linear infinite' }} />
                    <div style={{ fontSize: '15px', color: '#fff', fontWeight: 'bold' }}>{generationStep}</div>
                    <p style={{ color: '#6b7280', fontSize: '11px', margin: 0 }}>KAIROS agents are assessing scope constraints...</p>
                  </div>
                ) : roadmap.length === 0 ? (
                  <div style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: '#6b7280' }}>
                    Roadmap milestones will render here.
                  </div>
                ) : (
                  <RoadmapFlowchart 
                    roadmap={roadmap} 
                    tasks={tasks}
                    blockers={blockers}
                    onNodeClick={(node) => console.log("Clicked Node:", node)}
                  />
                )}
              </div>
            </div>

            {/* Right Column: Critique & Chat Stacked */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', minHeight: '0' }}>
              
              {/* Critique panel (Top) */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '45%', minHeight: '0' }}>
                <div className="kairos-card-header" style={{ marginBottom: '12px' }}>/// SCOPE_CRITIQUE</div>
                {critique ? (
                  <div style={{ padding: '16px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '0px', flexGrow: 1, overflowY: 'auto' }}>
                    <MarkdownRenderer content={critique} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexGrow: 1, justifyContent: 'center', alignItems: 'center', color: '#6b7280', fontSize: '13px' }}>
                    {isGenerating ? "Analyzing project idea and streaming critique..." : "Critique assessment will stream here..."}
                  </div>
                )}
              </div>

              {/* Chat panel (Bottom) */}
              <div style={{ display: 'flex', flexDirection: 'column', height: '55%', minHeight: '0' }}>
                <div className="glass-card" style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '16px', height: 'calc(100% - 60px)' }}>
                  {messages.map((m, idx) => (
                    <div key={idx} style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      background: m.role === 'user' ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.03)',
                      border: m.role === 'user' ? '1px solid rgba(139,92,246,0.3)' : '1px solid var(--border-color)',
                      padding: '12px 16px',
                      borderRadius: '0px',
                      fontSize: '13px',
                      lineHeight: '1.5'
                    }}>
                      <div style={{ fontSize: '10px', color: '#6b7280', fontWeight: 'bold', marginBottom: '4px' }}>
                        {m.role === 'user' ? 'YOU' : 'KAIROS COACH'}
                      </div>
                      <MarkdownRenderer content={m.content} />
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat input */}
                <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ flexGrow: 1 }}
                    placeholder="Request changes or ask coding questions..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={isGenerating}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0 20px' }} disabled={isGenerating}>
                    <Send size={16} />
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'rgba(15, 13, 20, 0.9)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '0px',
          padding: '16px 20px',
          color: '#fff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'slideIn 0.3s ease-out',
          maxWidth: '350px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: toast.type === 'success' ? '#10b981' : '#ef4444'
          }} />
          <span style={{ fontSize: '14px', fontWeight: '500' }}>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
