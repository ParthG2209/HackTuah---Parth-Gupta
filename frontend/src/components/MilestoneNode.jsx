import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { CheckCircle2, Play, Circle, AlertTriangle, Clock } from 'lucide-react';

export default function MilestoneNode({ data }) {
  const { milestone, tasks, blockers, isExpanded, toggleExpand, phaseColor, index } = data;
  
  const tasksToShow = isExpanded ? tasks : tasks.slice(0, 3);

  return (
    <div className="roadmap-sh-card interactive-hover" style={{ 
      border: `1px solid ${phaseColor}40`,
      width: '320px', // Fixed width for nodes
      backgroundColor: 'rgba(15, 17, 26, 0.85)',
      backdropFilter: 'blur(16px)',
      borderRadius: '0px',
      boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px ${phaseColor}15`,
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Target Handle (Incoming edges) */}
      <Handle type="target" position={Position.Top} style={{ background: phaseColor, width: 8, height: 8, border: 'none' }} />

      <div className="card-title" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderBottom: `1px solid ${phaseColor}20`,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        padding: '10px 14px',
        fontSize: '12px',
        fontWeight: 900,
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        <span style={{ color: phaseColor }}>{milestone.phase} : {milestone.title}</span>
        <span className={`metadata-tag risk-${milestone.risk_level}`} style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '0px', border: '1px solid rgba(255,255,255,0.08)' }}>
          {milestone.risk_level}
        </span>
      </div>
      
      <div className="card-body" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.5', color: '#d1d5db' }}>
          <strong>Deliverable:</strong> {milestone.deliverable}
        </p>

        <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: '#94a3b8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '0px' }}>
            <Clock size={12} /> {milestone.duration_estimate || 'N/A'}
          </div>
        </div>

        {tasks.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Tasks</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tasksToShow.map(t => (
                <div key={t.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  padding: '6px 10px',
                  borderRadius: '0px',
                  fontSize: '11px',
                  fontWeight: 600
                }}>
                  {t.status === 'completed' ? (
                    <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                  ) : t.status === 'in_progress' ? (
                    <Play size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
                  ) : (
                    <Circle size={14} style={{ color: '#64748b', flexShrink: 0 }} />
                  )}
                  <span style={{ 
                    textDecoration: t.status === 'completed' ? 'line-through' : 'none',
                    opacity: t.status === 'completed' ? 0.5 : 0.9,
                    color: '#e5e7eb'
                  }}>
                    {t.name}
                  </span>
                </div>
              ))}
              {tasks.length > 3 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(index);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3b82f6',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: '4px 0',
                    textTransform: 'uppercase'
                  }}
                >
                  {isExpanded ? 'Show Less' : `+ ${tasks.length - 3} More`}
                </button>
              )}
            </div>
          </div>
        )}

        {blockers.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.2)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {blockers.map(b => (
              <div key={b.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '6px 10px',
                borderRadius: '0px',
                fontSize: '11px',
                color: '#fca5a5'
              }}>
                <AlertTriangle size={12} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span>{b.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Source Handle (Outgoing edges) */}
      <Handle type="source" position={Position.Bottom} style={{ background: phaseColor, width: 8, height: 8, border: 'none' }} />
    </div>
  );
}
