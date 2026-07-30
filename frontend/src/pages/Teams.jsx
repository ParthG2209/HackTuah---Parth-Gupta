import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Users, Plus, Key, RefreshCw, Layers, Shield } from 'lucide-react';

export default function Teams() {
  const { profile, API_BASE } = useAuth();
  const [teams, setTeams] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [activeTeamId, setActiveTeamId] = useState(null);
  const [activeTeam, setActiveTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTeams = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/teams/user/${profile.id}`);
      setTeams(res.data);
      if (res.data.length > 0 && !activeTeamId) {
        setActiveTeamId(res.data[0].id);
      }
    } catch (e) {
      console.error("Error loading teams:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveTeamDetails = async () => {
    if (!activeTeamId) return;
    try {
      const res = await axios.get(`${API_BASE}/teams/${activeTeamId}`);
      setActiveTeam(res.data);
    } catch (e) {
      console.error("Error fetching team details:", e);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [profile]);

  useEffect(() => {
    fetchActiveTeamDetails();
  }, [activeTeamId]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    try {
      const res = await axios.post(`${API_BASE}/teams`, {
        name: teamName,
        leader_id: profile.id
      });
      setTeamName('');
      alert(`Team created successfully! Code: ${res.data.code}`);
      await fetchTeams();
      setActiveTeamId(res.data.id);
    } catch (err) {
      console.error("Error creating team:", err);
      alert("Error creating team.");
    }
  };

  const handleJoinTeam = async (e) => {
    e.preventDefault();
    if (!teamCode.trim()) return;
    try {
      const res = await axios.post(`${API_BASE}/teams/join`, {
        code: teamCode.trim(),
        profile_id: profile.id
      });
      setTeamCode('');
      alert(`Successfully joined team: ${res.data.name}`);
      await fetchTeams();
      setActiveTeamId(res.data.id);
    } catch (err) {
      console.error("Error joining team:", err);
      alert(err.response?.data?.detail || "Error joining team. Check your code.");
    }
  };

  const handleSyncDetails = async () => {
    if (!activeTeamId) return;
    try {
      const res = await axios.post(`${API_BASE}/teams/${activeTeamId}/sync`);
      setActiveTeam(res.data);
      alert("Synchronized master JSON with updated member details!");
    } catch (err) {
      console.error("Error syncing master JSON:", err);
      alert("Failed to sync team details.");
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ animation: 'spinSlow 2s linear infinite' }}>●</div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="dashboard-header">
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#fff' }}>Teams Dashboard</h1>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px' }}>
            Coordinate and sync skills profiles with teammates.
          </p>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        {/* Create / Join Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="glass-card">
            <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '16px' }}>
              <Plus size={18} style={{ color: '#10b981' }} /> Create Team
            </h3>
            <form onSubmit={handleCreateTeam}>
              <div className="form-group">
                <label className="form-label">Team Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Aegis Hackers"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Create Team
              </button>
            </form>
          </div>

          <div className="glass-card">
            <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '16px' }}>
              <Key size={18} style={{ color: '#8b5cf6' }} /> Join Team
            </h3>
            <form onSubmit={handleJoinTeam}>
              <div className="form-group">
                <label className="form-label">Join Code</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. KAI-ABCD"
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>
                Join Team
              </button>
            </form>
          </div>

          <div className="glass-card">
            <h3 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '16px' }}>
              <Users size={18} style={{ color: '#ec4899' }} /> Your Teams
            </h3>
            {teams.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '12px' }}>You aren't in any teams yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {teams.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTeamId(t.id)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      background: activeTeamId === t.id ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)',
                      border: activeTeamId === t.id ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--border-color)',
                      color: activeTeamId === t.id ? '#60a5fa' : '#fff',
                      borderRadius: '0px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <span>{t.name}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#8b5cf6', fontWeight: 'bold' }}>
                      {t.code}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Team Details & Master JSON */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeTeam ? (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '24px', color: '#fff' }}>{activeTeam.name}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#8b5cf6', background: 'rgba(139,92,246,0.1)', padding: '2px 8px', borderRadius: '0px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                      CODE: {activeTeam.code}
                    </span>
                    {activeTeam.leader_id === profile.id && (
                      <span style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Shield size={12} /> Team Leader
                      </span>
                    )}
                  </div>
                </div>
                
                {activeTeam.leader_id === profile.id && (
                  <button onClick={handleSyncDetails} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                    <RefreshCw size={14} /> Fetch Latest Details
                  </button>
                )}
              </div>

              <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                Team Members
                <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '0px' }}>{activeTeam.members.length}</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                {activeTeam.members.map(m => (
                  <div key={m.id} style={{ padding: '20px', background: 'linear-gradient(145deg, rgba(22, 19, 28, 0.8), rgba(12, 10, 15, 0.9))', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0px', position: 'relative', overflow: 'hidden' }} className="team-hover-glow">
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: m.primary_role.includes('Leader') ? '#10b981' : '#8b5cf6' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '0px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', color: '#fff' }}>
                          {m.full_name.slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ color: '#fff', fontSize: '15px', display: 'block', lineHeight: '1.2' }}>{m.full_name}</strong>
                          <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>{m.primary_role}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', background: 'rgba(0,0,0,0.2)', padding: '8px', border: '1px dashed rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: '11px', color: '#d1d5db' }}>Experience Level</span>
                      <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 'bold' }}>{m.experience_level}</span>
                    </div>

                    <div>
                      <span style={{ fontSize: '10px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px', display: 'block', fontWeight: 'bold' }}>Core Skills</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {m.tech_stack.map(tech => (
                          <span key={tech} style={{ fontSize: '10px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa', padding: '4px 8px', borderRadius: '0px' }}>
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', marginBottom: '12px' }}>
                <Layers size={16} style={{ color: '#8b5cf6' }} /> Synchronized Skills Master JSON
              </h3>
              <div style={{ background: '#0a0d14', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', borderRadius: '0px', overflowX: 'auto' }}>
                <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '13px', color: '#34d399', lineHeight: '1.5' }}>
                  {JSON.stringify(activeTeam.master_json, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="glass-card" style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '60px' }}>
              <p style={{ color: '#9ca3af' }}>Select or create a team to see synchronization details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
