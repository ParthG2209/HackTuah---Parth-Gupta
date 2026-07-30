import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Users, Award, Brain, RefreshCw, Plus, Check, ArrowLeft } from 'lucide-react';
import MarkdownRenderer from '../components/MarkdownRenderer';
import VoiceAssistantWidget from '../components/VoiceAssistantWidget';
import SessionCard from '../components/SessionCard';
export default function Tasks() {
  const { profile, API_BASE } = useAuth();
  
  const [view, setView] = useState('sessions'); // 'sessions' | 'board'
  const [sessions, setSessions] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  
  const [tasks, setTasks] = useState([]);
  const [blockers, setBlockers] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState('');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [syncingBoard, setSyncingBoard] = useState(false);

  // Blocker AI Fix Suggestion States
  const [blockerSuggestions, setBlockerSuggestions] = useState({});
  const [loadingFixId, setLoadingFixId] = useState('');

  // Column dragover state
  const [draggedOverColumn, setDraggedOverColumn] = useState(null);

  // Manual Task Creation State (Leader view)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newMilestoneId, setNewMilestoneId] = useState('phase_1');

  // Custom Blocker Modal state
  const [blockingModalData, setBlockingModalData] = useState(null); // { taskId: '...', targetStatus: '...' }
  const [blockReasonInput, setBlockReasonInput] = useState('');

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
      // Only show sessions that are in execution or completed phase
      const execSessions = res.data.filter(s => s.status === 'execution' || s.status === 'completed');
      setSessions(execSessions);
    } catch (e) {
      console.error("Error loading sessions for task board:", e);
    }
  };

  const fetchSessionDetails = async () => {
    if (!activeSessionId) return;
    setSyncingBoard(true);
    try {
      const sRes = await axios.get(`${API_BASE}/sessions/${activeSessionId}`);
      setActiveSession(sRes.data);

      const tasksRes = await axios.get(`${API_BASE}/sessions/${activeSessionId}/tasks`);
      setTasks(tasksRes.data);

      const blockersRes = await axios.get(`${API_BASE}/sessions/${activeSessionId}/blockers`);
      setBlockers(blockersRes.data.filter(b => b.status === 'open'));

      // Fetch team members
      if (sRes.data.team_id) {
        const teamRes = await axios.get(`${API_BASE}/teams/${sRes.data.team_id}`);
        setTeamMembers(teamRes.data.members || []);
      } else {
        // Solo, only profile is member
        setTeamMembers([profile]);
      }
    } catch (e) {
      console.error("Error loading task board data:", e);
    } finally {
      setSyncingBoard(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchMyTeams();
  }, [profile]);

  useEffect(() => {
    if (activeSessionId) {
      fetchSessionDetails();
      setAiSuggestions('');
    }
    const handleTaskUpdated = () => {
      if (activeSessionId) fetchSessionDetails();
    };
    window.addEventListener('kairos:task_updated', handleTaskUpdated);
    return () => window.removeEventListener('kairos:task_updated', handleTaskUpdated);
  }, [activeSessionId]);

  const handleStatusChange = async (taskId, nextStatus, blockerDescription = null) => {
    try {
      // Optimistic update for drag-and-drop response feel
      setTasks(prevTasks => prevTasks.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));
      
      const payload = { status: nextStatus };
      if (blockerDescription) {
        payload.blocker_description = blockerDescription;
      }
      
      await axios.put(`${API_BASE}/tasks/${taskId}`, payload);
      // Fetch fresh details quietly in the background to sync DB states
      fetchSessionDetails();
    } catch (e) {
      console.error("Error updating task status:", e);
    }
  };

  const handleAssigneeChange = async (taskId, assigneeId) => {
    try {
      await axios.put(`${API_BASE}/tasks/${taskId}`, { assigned_to: assigneeId || null });
      await fetchSessionDetails();
    } catch (e) {
      console.error("Error re-assigning task:", e);
    }
  };

  const handleLoadSuggestions = async () => {
    if (!activeSessionId) return;
    setLoadingSuggestions(true);
    try {
      const res = await axios.get(`${API_BASE}/sessions/${activeSessionId}/task-suggestions`);
      setAiSuggestions(res.data.suggestions);
    } catch (e) {
      console.error("Error fetching AI suggestions:", e);
      setAiSuggestions("Unable to pull recommendations at this time.");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleGetBlockerFix = async (blockerId) => {
    setLoadingFixId(blockerId);
    try {
      const res = await axios.post(`${API_BASE}/tasks/blockers/${blockerId}/suggest-fix`);
      setBlockerSuggestions(prev => ({
        ...prev,
        [blockerId]: res.data.suggestion
      }));
    } catch (e) {
      console.error("Error getting blocker suggestions:", e);
      setBlockerSuggestions(prev => ({
        ...prev,
        [blockerId]: "Unable to parse a solution. Check backend connectivity."
      }));
    } finally {
      setLoadingFixId('');
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskName.trim() || !activeSessionId) return;

    try {
      await axios.post(`${API_BASE}/sessions/${activeSessionId}/tasks`, {
        name: newTaskName,
        assigned_to: newAssigneeId || null,
        priority: newPriority,
        milestone_id: newMilestoneId
      });
      setNewTaskName('');
      setShowAddForm(false);
      await fetchSessionDetails();
    } catch (err) {
      console.error("Error adding custom task:", err);
    }
  };

  const handleOpenBoard = (sessionId) => {
    setActiveSessionId(sessionId);
    setView('board');
  };

  const handleBackToSessions = () => {
    setView('sessions');
    setActiveSessionId('');
    setActiveSession(null);
    setTasks([]);
  };

  return (
    <div className="main-content">
      {view === 'sessions' ? (
        // Grid View of active execution projects (Similar to AI Coach layout)
        <div>
          <div className="dashboard-header" style={{ marginBottom: '32px' }}>
            <div>
              <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#fff' }}>AI Task Boards</h1>
              <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px' }}>
                Select an active coaching session currently in execution to coordinate tasks and track project milestones.
              </p>
            </div>
            <button onClick={fetchSessions} className="btn btn-secondary" style={{ padding: '10px 16px' }}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '60px' }}>
              <ShieldAlert size={48} style={{ color: '#6b7280', marginBottom: '16px' }} />
              <h3 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>No active roadmaps in execution</h3>
              <p style={{ color: '#9ca3af', fontSize: '14px', maxWidth: '500px', margin: '0 auto' }}>
                Go to the **Coach Room**, select or start a session, build a roadmap, and click **"Accept & Start Execution"** to unlock the Task Board.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
              {sessions.map(s => (
                <SessionCard 
                  key={s.id} 
                  session={s} 
                  onClick={() => handleOpenBoard(s.id)} 
                  actionLabel="Open Task Board"
                  teams={myTeams} 
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        // Dedicated Kanban Board View with Drag and Drop
        <div>
          <div className="dashboard-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button onClick={handleBackToSessions} className="btn btn-secondary" style={{ padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowLeft size={18} />
              </button>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', background: 'rgba(191,133,255,0.1)', border: '1px solid rgba(191,133,255,0.2)', padding: '2px 8px', borderRadius: '0px', color: 'var(--accent-primary)' }}>
                    {activeSession?.team_id ? 'Team Execution' : 'Solo Execution'}
                  </span>
                </div>
                <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#fff', marginTop: '4px' }}>{activeSession?.name}</h1>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button onClick={fetchSessionDetails} className="btn btn-secondary" style={{ padding: '10px 16px' }} disabled={syncingBoard}>
                <RefreshCw size={16} /> Sync Board
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
            
            {/* AI Advisor Panel */}
            <div className="glass-card" style={{ background: 'rgba(59, 130, 246, 0.03)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Brain size={20} style={{ color: '#8b5cf6' }} />
                  <h3 style={{ fontSize: '16px', color: '#fff' }}>KAIROS Execution Engine suggestions</h3>
                </div>
                <button onClick={handleLoadSuggestions} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '12px' }} disabled={loadingSuggestions}>
                  {loadingSuggestions ? 'Analyzing...' : 'Ask AI for Suggestions'}
                </button>
              </div>
              {aiSuggestions && (
                <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '0px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '13px', color: '#e5e7eb', lineHeight: '1.6' }}>
                  <MarkdownRenderer content={aiSuggestions} />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              {/* Blocker Reminders with AI Fix Resolutions */}
              <div className="glass-card" style={{ background: 'rgba(239, 68, 68, 0.02)', borderColor: 'rgba(239, 68, 68, 0.15)' }}>
                <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '12px' }}>
                  <ShieldAlert size={16} style={{ color: '#ef4444' }} /> Active Project Blockers
                </h3>
                {blockers.length === 0 ? (
                  <p style={{ color: '#9ca3af', fontSize: '13px' }}>Awesome! No active task blockages registered.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {blockers.map(b => (
                      <div key={b.id} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '14px', borderRadius: '0px', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: '#f3f4f6', fontWeight: '500' }}>{b.description}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '9px', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', padding: '2px 6px', borderRadius: '0px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                              {b.severity}
                            </span>
                            <button 
                              onClick={() => handleGetBlockerFix(b.id)} 
                              className="btn btn-primary" 
                              style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '0px' }}
                              disabled={loadingFixId === b.id}
                            >
                              {loadingFixId === b.id ? 'Thinking...' : '💡 Ask KAIROS for Fix'}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible AI suggestion */}
                        {blockerSuggestions[b.id] && (
                          <div style={{ marginTop: '4px', padding: '14px', background: 'rgba(0,0,0,0.25)', borderRadius: '0px', fontSize: '12px', borderLeft: '3px solid var(--accent-primary)', color: '#d1d5db', lineHeight: '1.6' }}>
                            <MarkdownRenderer content={blockerSuggestions[b.id]} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Manual Task Injection */}
              {activeSession && activeSession.creator_id === profile.id && (
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  {!showAddForm ? (
                    <button onClick={() => setShowAddForm(true)} className="btn btn-secondary" style={{ width: '100%' }}>
                      + Create Custom Task
                    </button>
                  ) : (
                    <form onSubmit={handleAddTask} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Task details..."
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        required
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select
                          className="form-select"
                          value={newAssigneeId}
                          onChange={(e) => setNewAssigneeId(e.target.value)}
                          style={{ flexGrow: 1, fontSize: '12px' }}
                        >
                          <option value="">Assignee...</option>
                          {teamMembers.map(m => (
                            <option key={m.id} value={m.id}>{m.full_name}</option>
                          ))}
                        </select>
                        <select
                          className="form-select"
                          value={newPriority}
                          onChange={(e) => setNewPriority(e.target.value)}
                          style={{ fontSize: '12px' }}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" className="btn btn-primary" style={{ flexGrow: 1, padding: '8px' }}>
                          <Check size={14} /> Add
                        </button>
                        <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary" style={{ padding: '8px' }}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Kanban Columns with native HTML5 Drag and Drop */}
            <div className="kanban-board">
              {['pending', 'in_progress', 'completed', 'blocked'].map(statusName => {
                const columnTasks = tasks.filter(t => t.status === statusName);
                const isOver = draggedOverColumn === statusName;
                
                return (
                  <div 
                    key={statusName} 
                    className={`kanban-column ${isOver ? 'drag-over' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => setDraggedOverColumn(statusName)}
                    onDragLeave={() => setDraggedOverColumn(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDraggedOverColumn(null);
                      const taskId = e.dataTransfer.getData("text/plain");
                      if (taskId) {
                        if (statusName === 'blocked') {
                          setBlockingModalData({ taskId: taskId, targetStatus: statusName });
                          setBlockReasonInput('');
                        } else {
                          handleStatusChange(taskId, statusName);
                        }
                      }
                    }}
                  >
                    <div className="column-header">
                      <span style={{ textTransform: 'capitalize' }}>
                        {statusName === 'in_progress' ? 'In Progress' : statusName}
                      </span>
                      <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '0px' }}>
                        {columnTasks.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', minHeight: '200px' }}>
                      {columnTasks.length === 0 ? (
                        <div style={{ border: '2px dashed rgba(255,255,255,0.02)', borderRadius: '0px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', fontSize: '12px' }}>
                          Drag tasks here
                        </div>
                      ) : (
                        columnTasks.map(t => {
                          const isBlocked = t.status === 'blocked';
                          return (
                            <div 
                              key={t.id} 
                              className="task-card"
                              draggable="true"
                              onDragStart={(e) => {
                                  e.dataTransfer.setData("text/plain", t.id);
                              }}
                              style={isBlocked ? { borderColor: 'rgba(239, 68, 68, 0.45)', boxShadow: '0 0 10px rgba(239, 68, 68, 0.1)' } : {}}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <span className={`task-tag priority-${t.priority}`}>{t.priority}</span>
                                <select
                                  value={t.status}
                                  onChange={(e) => {
                                    if (e.target.value === 'blocked') {
                                      setBlockingModalData({ taskId: t.id, targetStatus: e.target.value });
                                      setBlockReasonInput('');
                                    } else {
                                      handleStatusChange(t.id, e.target.value);
                                    }
                                  }}
                                  style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: '11px', cursor: 'pointer' }}
                                >
                                  <option value="pending">Pending</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="completed">Completed</option>
                                  <option value="blocked">Blocked</option>
                                </select>
                              </div>
                              <div style={{ color: '#fff', fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>
                                {t.name}
                              </div>
                              
                              {/* Assignee & Allocation */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                                <span style={{ fontSize: '11px', color: '#6b7280' }}>Assignee:</span>
                                <select
                                  value={t.assigned_to || ''}
                                  onChange={(e) => handleAssigneeChange(t.id, e.target.value)}
                                  disabled={activeSession && activeSession.creator_id !== profile.id}
                                  style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '11px', cursor: 'pointer', maxWidth: '120px' }}
                                >
                                  <option value="">Unassigned</option>
                                  {teamMembers.map(m => (
                                    <option key={m.id} value={m.id}>{m.full_name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}
      {blockingModalData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert style={{ color: '#ef4444' }} /> Flag Task as Blocked
            </h3>
            <p style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '20px', lineHeight: '1.5' }}>
              What is holding back this task? Please describe the blocker details so KAIROS Coach can suggest a fix.
            </p>
            <textarea
              className="form-textarea"
              rows={4}
              placeholder="e.g. Supabase client connection is failing with invalid credentials error..."
              value={blockReasonInput}
              onChange={(e) => setBlockReasonInput(e.target.value)}
              style={{ width: '100%', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '0px', padding: '12px' }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => {
                  setBlockingModalData(null);
                  setBlockReasonInput('');
                }} 
                className="btn btn-secondary"
                style={{ padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (blockingModalData) {
                    handleStatusChange(blockingModalData.taskId, blockingModalData.targetStatus, blockReasonInput || 'Unspecified technical blocker');
                  }
                  setBlockingModalData(null);
                  setBlockReasonInput('');
                }}
                className="btn btn-primary"
                style={{ padding: '8px 16px', background: '#ef4444' }}
              >
                Block Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline helper for Calendar icon as simple svg
function Calendar({ size = 16, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}
