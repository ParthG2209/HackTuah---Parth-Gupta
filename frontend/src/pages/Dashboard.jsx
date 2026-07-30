import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  RefreshCw, CheckCircle2, Clock, AlertTriangle, Calendar, Plus, 
  Search, Bell, Grid, Settings, Moon, ChevronDown, Check, User,
  Shield, Layout, Activity, ShieldAlert
} from 'lucide-react';
import { getTechIconUrl } from '../utils/techIcons';

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile, API_BASE, user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [allBlockers, setAllBlockers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters & State
  const [taskFilter, setTaskFilter] = useState('all'); // all, pending, done
  const [sortBy, setSortBy] = useState('name'); // name, priority
  const [newTaskName, setNewTaskName] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');

  const fetchData = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Fetch user teams
      const teamsRes = await axios.get(`${API_BASE}/teams/user/${profile.id}`);
      setTeams(teamsRes.data);

      // 2. Fetch all sessions
      const sessionsRes = await axios.get(`${API_BASE}/sessions`, {
        params: { profile_id: profile.id }
      });
      const sessionsList = Array.isArray(sessionsRes.data) ? sessionsRes.data : [];
      const teamsList = Array.isArray(teamsRes.data) ? teamsRes.data : [];

      const userSessions = sessionsList.filter(s => 
        s.creator_id === profile.id || teamsList.some(t => t.id === s.team_id)
      );
      setSessions(userSessions);
      if (userSessions.length > 0 && !selectedSessionId) {
        setSelectedSessionId(userSessions[0].id);
      }

      // 3. Fetch tasks & blockers for each session
      let compiledTasks = [];
      let compiledBlockers = [];
      
      for (const s of userSessions) {
        try {
          const tasksRes = await axios.get(`${API_BASE}/sessions/${s.id}/tasks`);
          compiledTasks = [...compiledTasks, ...tasksRes.data.map(t => ({ ...t, sessionName: s.name }))];

          const blockersRes = await axios.get(`${API_BASE}/sessions/${s.id}/blockers`);
          compiledBlockers = [...compiledBlockers, ...blockersRes.data.filter(b => b.status === 'open').map(b => ({ ...b, sessionName: s.name }))];
        } catch (e) {
          console.error(`Error loading data for session ${s.id}`, e);
        }
      }
      
      setAllTasks(compiledTasks);
      setAllBlockers(compiledBlockers);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleTaskUpdated = () => fetchData();
    window.addEventListener('kairos:task_updated', handleTaskUpdated);
    return () => window.removeEventListener('kairos:task_updated', handleTaskUpdated);
  }, [profile]);

  const handleStatusToggle = async (taskId, currentStatus) => {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    try {
      await axios.put(`${API_BASE}/tasks/${taskId}`, { status: nextStatus });
      
      // Update local state directly for speed
      setAllTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));
    } catch (e) {
      console.error("Error updating task status:", e);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskName.trim() || !selectedSessionId) return;

    // Find milestone_id for the first milestone in this session
    const currentSession = sessions.find(s => s.id === selectedSessionId);
    const milestones = currentSession?.milestones || [];
    const milestoneId = milestones.length > 0 ? (milestones[0].phase || "phase_1") : "phase_1";

    try {
      const res = await axios.post(`${API_BASE}/sessions/${selectedSessionId}/tasks`, {
        name: newTaskName.trim(),
        milestone_id: milestoneId,
        priority: "medium",
        dependencies: []
      });

      setNewTaskName('');
      fetchData(); // Reload list & counts
    } catch (err) {
      console.error("Error creating task:", err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexGrow: 1, justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <div style={{ animation: 'spinSlow 2s linear infinite', color: '#bf85ff', fontSize: '28px' }}>●</div>
      </div>
    );
  }

  // Filter & Sort Tasks
  let filteredTasks = [...allTasks];
  if (taskFilter === 'pending') {
    filteredTasks = filteredTasks.filter(t => t.status !== 'completed');
  } else if (taskFilter === 'done') {
    filteredTasks = filteredTasks.filter(t => t.status === 'completed');
  }

  if (sortBy === 'name') {
    filteredTasks.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'priority') {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    filteredTasks.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));
  }

  // Calculate stats for top card widgets
  const getSessionStats = (sess) => {
    const sessTasks = allTasks.filter(t => t.session_id === sess.id);
    const completed = sessTasks.filter(t => t.status === 'completed').length;
    const pct = sessTasks.length > 0 ? Math.round((completed / sessTasks.length) * 100) : 0;
    return { count: sessTasks.length, completed, pct };
  };

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }}>
      
      {/* Top Header bar matching Mockup */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.02em', marginBottom: '4px' }}>Dashboard</h1>
          <p style={{ fontSize: '13px', color: '#a1a1aa' }}>
            Overview of your active workspace sessions and milestone checklist.
          </p>
        </div>

        {/* Global Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: '#71717a' }} />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '2px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '0px',
                padding: '8px 16px 8px 36px',
                fontSize: '13px',
                color: '#fff',
                width: '180px',
                outline: 'none',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.width = '240px';
                e.target.style.borderColor = '#bf85ff';
              }}
              onBlur={(e) => {
                e.target.style.width = '180px';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }}
            />
          </div>

          <button style={{ background: 'rgba(255, 255, 255, 0.04)', border: '2px solid rgba(255, 255, 255, 0.15)', padding: '8px', borderRadius: '0px', color: '#a1a1aa', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Bell size={16} />
          </button>

          <button 
            onClick={() => navigate('/coach')}
            style={{
              background: 'linear-gradient(135deg, #bf85ff, #f472b6)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              padding: '8px 16px',
              borderRadius: '0px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '4px 4px 0px rgba(0, 0, 0, 0.3)',
              cursor: 'pointer',
              transition: 'transform 0.1s ease, box-shadow 0.1s ease'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translate(2px, 2px)';
              e.currentTarget.style.boxShadow = '2px 2px 0px rgba(0, 0, 0, 0.3)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '4px 4px 0px rgba(0, 0, 0, 0.3)';
            }}
          >
            <Plus size={14} />
            <span>Create new</span>
          </button>
        </div>
      </div>

      {/* 3 Top Progress Grid Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {sessions.slice(0, 3).map((s, idx) => {
          const stats = getSessionStats(s);
          return (
            <div key={s.id} className="kairos-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderRadius: '0px', border: '2px solid rgba(255, 255, 255, 0.15)' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#ffffff', marginBottom: '6px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {s.name}
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#a1a1aa' }}>
                  <span>Progress</span>
                  <span style={{ fontWeight: '700', color: '#bf85ff' }}>{stats.pct}%</span>
                </div>
              </div>

              {/* Progress Bar fill */}
              <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '0px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${stats.pct}%`,
                  background: idx === 0 ? '#bf85ff' : idx === 1 ? '#f472b6' : '#38bdf8',
                  borderRadius: '0px'
                }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#71717a' }}>
                  {new Date(s.created_at || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                
                {/* Team member circles */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {(() => {
                    const sessionTeam = teams.find(t => t.id === s.team_id);
                    const membersList = (sessionTeam && Array.isArray(sessionTeam.members)) ? sessionTeam.members : (profile ? [profile] : []);
                    return membersList.slice(0, 3).map((m, mIdx) => {
                      if (!m) return null;
                      const colors = ['#bf85ff', '#f472b6', '#38bdf8'];
                      const initials = (m.full_name || m.name || 'User').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                      return (
                        <div 
                          key={m.id || mIdx}
                          style={{ 
                            width: '22px', 
                            height: '22px', 
                            borderRadius: '0px', 
                            background: colors[mIdx % colors.length], 
                            border: '1.5px solid #0f0d14', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: '9px', 
                            fontWeight: 'bold', 
                            color: '#000',
                            marginLeft: mIdx > 0 ? '-6px' : '0', 
                            zIndex: 3 - mIdx 
                          }}
                          title={m.full_name || m.name}
                        >
                          {initials}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          );
        })}
        {sessions.length === 0 && (
          <div className="kairos-card" style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px', color: '#a1a1aa' }}>
            Create a session inside the Coach tab to begin tracking milestones.
          </div>
        )}
      </div>

      {/* Filter and Sort Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.02)', border: '2px solid rgba(255, 255, 255, 0.15)', padding: '4px', borderRadius: '0px' }}>
          <button 
            onClick={() => setTaskFilter('all')}
            style={{
              background: taskFilter === 'all' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '0px',
              color: taskFilter === 'all' ? '#fff' : '#a1a1aa',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            All Tasks
          </button>
          <button 
            onClick={() => setTaskFilter('pending')}
            style={{
              background: taskFilter === 'pending' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '0px',
              color: taskFilter === 'pending' ? '#fff' : '#a1a1aa',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Pending
          </button>
          <button 
            onClick={() => setTaskFilter('done')}
            style={{
              background: taskFilter === 'done' ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '0px',
              color: taskFilter === 'done' ? '#fff' : '#a1a1aa',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#71717a', textTransform: 'uppercase', fontFamily: 'monospace' }}>Sort by:</span>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              background: 'rgba(22, 19, 28, 0.85)',
              border: '2px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '0px',
              color: '#d1d5db',
              fontSize: '12px',
              padding: '6px 12px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="name">Alphabetical</option>
            <option value="priority">Priority</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Left Column for Task Manager / Right Column for Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '12px' }}>
        
        {/* Left Column: Tasks Manager */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Quick Task Creation Box */}
          {sessions.length > 0 && (
            <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '2px dashed rgba(255, 255, 255, 0.15)', padding: '12px', borderRadius: '0px', alignItems: 'center' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '0px', background: '#bf85ff', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                {(profile?.full_name || profile?.name || 'AA').slice(0, 2).toUpperCase()}
              </div>
              <input 
                type="text"
                placeholder="Type to add a new task..."
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#fff',
                  fontSize: '13px'
                }}
              />
              {sessions.length > 1 && (
                <select 
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  style={{
                    background: 'rgba(22, 19, 28, 0.9)',
                    border: '2px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '0px',
                    color: '#d1d5db',
                    fontSize: '11px',
                    padding: '4px 8px'
                  }}
                >
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.name.slice(0, 16)}...</option>
                  ))}
                </select>
              )}
              <button 
                type="submit"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '2px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '0px',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '5px 12px',
                  cursor: 'pointer'
                }}
              >
                Create Task
              </button>
            </form>
          )}

          {/* Task List container - Styled to group tasks with borders exactly like the mockup */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            border: '2px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '0px',
            background: 'rgba(22, 19, 28, 0.45)',
            overflow: 'hidden'
          }}>
            {filteredTasks.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#71717a', fontSize: '13px' }}>
                No tasks match the active filter.
              </div>
            ) : (
              filteredTasks.map((t, index) => {
                const isCompleted = t.status === 'completed';
                const isLast = index === filteredTasks.length - 1;
                return (
                  <div 
                    key={t.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      opacity: isCompleted ? 0.75 : 1,
                      borderBottom: isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
                      borderLeft: `4px solid ${t.priority === 'high' ? '#f472b6' : t.priority === 'medium' ? '#bf85ff' : '#38bdf8'}`,
                      background: isCompleted ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                      transition: 'background 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                      <button 
                        onClick={() => handleStatusToggle(t.id, t.status)}
                        style={{
                          background: isCompleted ? '#bf85ff' : 'transparent',
                          border: `2px solid ${isCompleted ? '#bf85ff' : 'rgba(255, 255, 255, 0.3)'}`,
                          width: '18px',
                          height: '18px',
                          borderRadius: '0px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        {isCompleted && <Check size={12} style={{ color: '#000', strokeWidth: 4 }} />}
                      </button>

                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ 
                          fontSize: '13px', 
                          fontWeight: '600', 
                          color: '#ffffff',
                          textDecoration: isCompleted ? 'line-through' : 'none'
                        }}>
                          {t.name}
                        </span>
                        <span style={{ fontSize: '10px', color: '#71717a', marginTop: '2px' }}>
                          Session: {t.sessionName || "General"} • Phase: {t.milestone_id}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <span 
                        className={`priority-${t.priority}`}
                        style={{
                          fontSize: '9px',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          textTransform: 'uppercase',
                          borderRadius: '0px'
                        }}
                      >
                        {t.priority}
                      </span>

                      <div style={{ width: '22px', height: '22px', borderRadius: '0px', background: '#bf85ff', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 'bold' }}>
                        {(profile?.full_name || profile?.name || 'AA').slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Due Tasks Widget */}
          <div className="kairos-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderRadius: '0px', border: '2px solid rgba(255, 255, 255, 0.15)', background: 'linear-gradient(145deg, rgba(22, 19, 28, 0.8), rgba(12, 10, 15, 0.9))' }}>
            <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due Tasks</h3>
              <span style={{ fontSize: '10px', background: 'rgba(244,114,182,0.1)', color: '#f472b6', padding: '4px 8px', borderRadius: '0px', border: '1px solid rgba(244,114,182,0.2)' }}>{allTasks.filter(t => t.status !== 'completed' && t.priority === 'high').length} PENDING</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {allTasks.filter(t => t.status !== 'completed' && t.priority === 'high').slice(0, 3).map(t => (
                <div key={t.id} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderLeft: '3px solid #f472b6', padding: '16px', borderRadius: '0px', cursor: 'pointer', transition: 'all 0.2s ease' }} className="task-hover-glow">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#fff', margin: 0 }}>{t.name}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#f472b6', background: 'rgba(244,114,182,0.1)', padding: '2px 6px', borderRadius: '0px' }}>
                      <Calendar size={10} /> HIGH
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '11px', color: '#a1a1aa', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Activity size={12} style={{ color: '#8b5cf6' }}/> Milestone ID: {t.milestone_id || 'Global'}
                    </p>
                    <span style={{ fontSize: '10px', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)', padding: '2px 6px' }}>{t.status}</span>
                  </div>
                </div>
              ))}

              {allTasks.filter(t => t.status !== 'completed' && t.priority === 'high').length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <CheckCircle2 size={24} style={{ color: '#34d399', marginBottom: '8px' }} />
                  <p style={{ fontSize: '12px', color: '#a1a1aa', fontStyle: 'italic', textAlign: 'center', margin: 0 }}>
                    No urgent high-priority tasks pending.<br/>You're all caught up!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Active Blockers Widget */}
          <div className="kairos-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderRadius: '0px', background: 'linear-gradient(145deg, rgba(22, 19, 28, 0.8), rgba(12, 10, 15, 0.9))' }}>
            <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Open Blockers</h3>
              {allBlockers.length > 0 && <span style={{ fontSize: '10px', background: 'rgba(248,113,113,0.1)', color: '#f87171', padding: '4px 8px', border: '1px solid rgba(248,113,113,0.2)' }}>{allBlockers.length} ISSUES</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {allBlockers.slice(0, 3).map(b => (
                <div key={b.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)', padding: '14px', borderRadius: '0px' }}>
                  <AlertTriangle size={16} style={{ color: '#f87171', marginTop: '2px', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: '#ffffff', fontWeight: '600', lineHeight: '1.4' }}>{b.description}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Layout size={10} /> {b.sessionName}
                      </div>
                      <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', color: '#fff' }}>BLOCKING</span>
                    </div>
                  </div>
                </div>
              ))}

              {allBlockers.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <Shield size={24} style={{ color: '#34d399', marginBottom: '8px' }} />
                  <p style={{ fontSize: '12px', color: '#a1a1aa', fontStyle: 'italic', textAlign: 'center', margin: 0 }}>
                    Workspace clear.<br/>No active roadblocks reported.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
