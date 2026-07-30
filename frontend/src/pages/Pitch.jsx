import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Presentation, Loader, Play, Send, RefreshCw, Layers, Download } from 'lucide-react';
import MarkdownRenderer from '../components/MarkdownRenderer';
import SessionCard from '../components/SessionCard';

export default function Pitch() {
  const { profile, API_BASE } = useAuth();
  
  const [sessions, setSessions] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  
  const [pitchText, setPitchText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('demo'); // 'demo' | 'slides' | 'showcase'
  const [inputText, setInputText] = useState('');

  const fetchMyTeams = async () => {
    if (!profile) return;
    try {
      const res = await axios.get(`${API_BASE}/teams/user/${profile.id}`);
      setMyTeams(res.data);
    } catch (e) {
      console.error("Error fetching user teams:", e);
    }
  };

  const fetchSessions = async () => {
    if (!profile) return;
    try {
      const res = await axios.get(`${API_BASE}/sessions`, {
        params: { profile_id: profile.id }
      });
      // Only sessions in execution or completed can generate pitch
      const planSessions = res.data.filter(s => s.status === 'execution' || s.status === 'completed');
      setSessions(planSessions);
    } catch (e) {
      console.error("Error loading sessions for pitch builder:", e);
    }
  };

  const fetchSessionDetails = async (forceOverwrite = false) => {
    if (!activeSessionId) return;
    try {
      const res = await axios.get(`${API_BASE}/sessions/${activeSessionId}`);
      setActiveSession(res.data);
      if (res.data.pitch_outline && res.data.pitch_outline.full_raw) {
        setPitchText(res.data.pitch_outline.full_raw);
      } else if (forceOverwrite) {
        setPitchText('');
      }
      // If not forceOverwrite, keep existing pitchText intact
    } catch (e) {
      console.error("Error loading pitch outline details:", e);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchMyTeams();
  }, [profile]);

  useEffect(() => {
    fetchSessionDetails(true);
  }, [activeSessionId]);

  const handleGeneratePitch = async (customInstruction = '') => {
    if (!activeSessionId) return;
    setIsGenerating(true);
    setPitchText('');
    
    try {
      const response = await fetch(`${API_BASE}/sessions/${activeSessionId}/pitch?model_preference=deepseek`, {
        method: 'POST'
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = '';
      let rawText = '';

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
                rawText += payload.content;
                setPitchText(rawText);
              }
            } catch (err) {}
          }
        }
      }

      // Save generated pitch outline to database
      try {
        await axios.put(`${API_BASE}/sessions/${activeSessionId}/pitch`, {
          pitch_outline: { full_raw: rawText }
        });
      } catch (saveErr) {
        console.error('Error saving pitch to DB:', saveErr);
      }
      setIsGenerating(false);
      // Don't call fetchSessionDetails - keep the streamed text as-is

    } catch (err) {
      console.error("Error generating pitch:", err);
      setIsGenerating(false);
    }
  };

  const handleRequestPitchChanges = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeSessionId) return;
    
    setIsGenerating(true);
    setPitchText('');
    const promptMessage = `Please regenerate the presentation layout. Custom instruction: ${inputText}`;
    setInputText('');

    try {
      const response = await fetch(`${API_BASE}/sessions/${activeSessionId}/pitch?model_preference=deepseek`, {
        method: 'POST'
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = '';
      let rawText = '';

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
                rawText += payload.content;
                setPitchText(rawText);
              }
            } catch (err) {}
          }
        }
      }

      // Save back to DB
      try {
        await axios.put(`${API_BASE}/sessions/${activeSessionId}/pitch`, {
          pitch_outline: { full_raw: rawText }
        });
      } catch (saveErr) {
        console.error('Error saving pitch to DB:', saveErr);
      }
      setIsGenerating(false);
      // Don't call fetchSessionDetails - keep the streamed text as-is

    } catch (err) {
      console.error("Error updating pitch:", err);
      setIsGenerating(false);
    }
  };

  // Helper to split generated Markdown into tabs
  const parseSection = (sectionName) => {
    if (!pitchText) return 'Click "Generate Presentation Suite" to begin compiling pitch assets.';
    
    // Look for standard headers
    const demoFlowStart = pitchText.indexOf('## Demo Flow');
    const pitchOutlineStart = pitchText.indexOf('## Pitch Outline');
    const finalShowcaseStart = pitchText.indexOf('## Final Pitch Showcase');

    const sections = {
      demo: '',
      slides: '',
      showcase: ''
    };

    if (demoFlowStart !== -1 && pitchOutlineStart !== -1) {
      sections.demo = pitchText.substring(demoFlowStart, pitchOutlineStart).trim();
    } else {
      sections.demo = pitchText.substring(0, pitchOutlineStart !== -1 ? pitchOutlineStart : undefined).trim();
    }

    if (pitchOutlineStart !== -1) {
      sections.slides = pitchText.substring(pitchOutlineStart, finalShowcaseStart !== -1 ? finalShowcaseStart : undefined).trim();
    }

    if (finalShowcaseStart !== -1) {
      sections.showcase = pitchText.substring(finalShowcaseStart).trim();
    }

    return sections[sectionName] || pitchText;
  };

  const activeContent = parseSection(activeTab);

  const handleExportSubmission = () => {
    if (!activeSessionId) return;
    window.open(`${API_BASE}/sessions/${activeSessionId}/pitch/export-submission`, '_blank');
  };

  const handleDownloadProjectPDF = async () => {
    if (!activeSessionId) return;
    try {
      showToast("Generating Executive Project PDF...", "info");
      const response = await axios.get(`${API_BASE}/sessions/${activeSessionId}/pitch/export-pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${activeSession?.name?.replace(/\s+/g, '_') || 'Project'}_Execution_Blueprint.pdf`);
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

  return (
    <div className="main-content">
      {!activeSessionId ? (
        <>
          <div className="dashboard-header">
            <div>
              <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#fff' }}>Presentation Pitch Studio</h1>
              <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px' }}>
                Select an active coaching session to structure final slide talking points, demo sequences, and script showcases.
              </p>
            </div>
          </div>

          <div className="dashboard-grid">
            {sessions.length === 0 ? (
              <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px' }}>
                <Presentation size={48} style={{ color: '#6b7280', marginBottom: '16px' }} />
                <p style={{ color: '#9ca3af' }}>No roadmap execution sessions unlocked. Establish your planning milestones on the Coach tab and click "Accept & Start Execution" first.</p>
              </div>
            ) : (
              sessions.map(s => (
                <SessionCard 
                  key={s.id} 
                  session={s} 
                  onClick={() => setActiveSessionId(s.id)} 
                  actionLabel="Open Pitch Studio"
                  teams={myTeams} 
                />
              ))
            )}
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1 }}>
          <div className="dashboard-header" style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button onClick={() => { setActiveSessionId(''); setPitchText(''); }} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                ← Back to Pitch Rooms
              </button>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', margin: 0 }}>Pitch Studio: {activeSession?.name}</h2>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleDownloadProjectPDF} className="btn btn-primary" style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', border: 'none' }}>
                <Download size={16} /> 📄 Export Full PDF Report
              </button>
              <button onClick={handleExportSubmission} className="btn btn-primary" style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none' }}>
                <Download size={16} /> Export Submission Package
              </button>
              {pitchText && (
                <button onClick={() => handleGeneratePitch()} className="btn btn-primary" style={{ padding: '10px 16px' }}>
                  <RefreshCw size={16} /> Regenerate Pitch
                </button>
              )}
              <button onClick={fetchSessionDetails} className="btn btn-secondary" style={{ padding: '10px 16px' }}>
                <RefreshCw size={16} /> Sync Studio
              </button>
            </div>
          </div>
          
          {/* Main Layout Workspace */}
          {!pitchText && !isGenerating ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '80px 40px' }}>
              <Presentation size={64} style={{ color: '#bf85ff', marginBottom: '24px' }} />
              <h2 style={{ fontSize: '28px', color: '#fff', marginBottom: '12px' }}>Generate Presentation Package</h2>
              <p style={{ color: '#9ca3af', maxWidth: '500px', margin: '0 auto 32px auto', fontSize: '14px', lineHeight: '1.6' }}>
                KAIROS will consolidate task completion, assignees, technical architecture, and milestones into a coherent Pitch Outline, Demo Path, and Full Script.
              </p>
              <button onClick={() => handleGeneratePitch()} className="btn btn-primary" style={{ padding: '14px 32px' }}>
                <Play size={16} /> Compile Presentation Suite
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2.2fr', gap: '12px', flexGrow: 1 }}>
              
              {/* Left Pane - Presentation Viewer */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '500px' }}>
                {/* Custom Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px', marginBottom: '24px', gap: '8px' }}>
                  <button
                    onClick={() => setActiveTab('demo')}
                    className={`btn ${activeTab === 'demo' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '0px' }}
                  >
                    Demo Flow sequence
                  </button>
                  <button
                    onClick={() => setActiveTab('slides')}
                    className={`btn ${activeTab === 'slides' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '0px' }}
                  >
                    Slide structures
                  </button>
                  <button
                    onClick={() => setActiveTab('showcase')}
                    className={`btn ${activeTab === 'showcase' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '0px' }}
                  >
                    Final Showcase Script
                  </button>
                </div>

                {isGenerating && !pitchText ? (
                  <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
                    <Loader className="spin" size={32} style={{ color: '#bf85ff', animation: 'spinSlow 2s linear infinite' }} />
                    <span style={{ color: '#9ca3af', fontSize: '13px' }}>Compiling project assets and skills profiles...</span>
                  </div>
                ) : (
                  <div style={{ flexGrow: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.03)', padding: '24px', borderRadius: '0px', maxHeight: '550px' }}>
                    <MarkdownRenderer content={activeContent} />
                  </div>
                )}
              </div>

              {/* Right Pane - Chat tuning interface */}
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '16px' }}>
                  <Layers size={18} style={{ color: '#bf85ff' }} /> Adjust Pitch Layout
                </h3>
                <p style={{ color: '#9ca3af', fontSize: '13px', lineHeight: '1.5', marginBottom: '24px' }}>
                  Instruct the AI Pitch Architect to modify specific slides, add technical depth, re-structure demo features, or edit speaking bullet points.
                </p>

                <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#6b7280', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '0px', padding: '20px', textAlign: 'center', fontSize: '12px', marginBottom: '16px' }}>
                  {isGenerating ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Loader size={16} className="spin" style={{ animation: 'spinSlow 2s linear infinite' }} />
                      <span>Re-generating presentation slides...</span>
                    </div>
                  ) : (
                    <span>Ready for modification input. Example: "Add a slide explaining our database architecture."</span>
                  )}
                </div>

                <form onSubmit={handleRequestPitchChanges} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ flexGrow: 1 }}
                    placeholder="Enter instructions to refine slides..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={isGenerating}
                  />
                  <button type="submit" className="btn btn-primary" disabled={isGenerating}>
                    <Send size={16} />
                  </button>
                </form>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
