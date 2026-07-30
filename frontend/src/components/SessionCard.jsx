import React from 'react';
import { Clock, Users, ArrowRight, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SessionCard({ session, onDelete, onClick, teams = [], actionLabel = "Open Room" }) {
  const { profile } = useAuth();
  
  // Try to figure out progress based on milestones
  const milestones = session.milestones || [];
  const completedMilestones = milestones.filter(m => m.status === 'completed').length;
  const progressPct = milestones.length > 0 ? Math.round((completedMilestones / milestones.length) * 100) : 0;
  
  // Find team members
  const safeTeams = Array.isArray(teams) ? teams : [];
  const sessionTeam = safeTeams.find(t => t && t.id === session.team_id);
  const membersList = (sessionTeam && Array.isArray(sessionTeam.members)) ? sessionTeam.members : (profile ? [profile] : []);
  
  return (
    <div className="glass-card session-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '200px', cursor: 'pointer' }} onClick={() => onClick && onClick(session)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>{session.name}</h3>
          <span style={{ 
            fontSize: '10px', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em', 
            fontWeight: 'bold',
            padding: '2px 8px',
            borderRadius: '0px',
            background: session.status === 'planning' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: session.status === 'planning' ? '#fcd34d' : '#6ee7b7',
            border: `1px solid ${session.status === 'planning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
          }}>
            {session.status}
          </span>
        </div>
        {onDelete && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
            style={{ 
              background: 'rgba(239, 68, 68, 0.1)', 
              border: '1px solid rgba(239, 68, 68, 0.2)', 
              color: '#f87171', 
              padding: '6px', 
              borderRadius: '0px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div style={{ flexGrow: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#a1a1aa', marginBottom: '8px' }}>
          <span>Phase Progress</span>
          <span style={{ color: '#bf85ff', fontWeight: '600' }}>{progressPct}%</span>
        </div>
        <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '0px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, #bf85ff, #f472b6)', borderRadius: '0px' }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {membersList.slice(0, 3).map((m, idx) => {
            if (!m) return null;
            const colors = ['#bf85ff', '#f472b6', '#38bdf8'];
            const initials = (m.full_name || m.name || 'U').substring(0, 2).toUpperCase();
            return (
              <div 
                key={m.id || idx}
                style={{ 
                  width: '26px', 
                  height: '26px', 
                  borderRadius: '50%', 
                  background: colors[idx % colors.length], 
                  border: '2px solid #1a1722', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '10px', 
                  fontWeight: 'bold', 
                  color: '#000',
                  marginLeft: idx > 0 ? '-8px' : '0', 
                  zIndex: 3 - idx,
                  boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                }}
                title={m.full_name || m.name}
              >
                {initials}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#bf85ff', fontWeight: '600' }}>
          {actionLabel} <ArrowRight size={14} />
        </div>
      </div>
    </div>
  );
}
