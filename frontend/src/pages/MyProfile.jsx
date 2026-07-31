import React from 'react';
import { useAuth } from '../context/AuthContext';
import { FaLinkedin, FaGithub } from 'react-icons/fa';
import StaggeredGrid from '../components/StaggeredGrid';

export default function ProfileView() {
  const { profile } = useAuth();

  const fullName = profile?.full_name || 'User Profile';
  const role = profile?.primary_role || 'Developer';
  const linkedinUrl = profile?.linkedin_url || '';
  const githubUrl = profile?.github_url || '';
  const techStack = profile?.tech_stack || [];

  const defaultBentoItems = [
    {
      id: 1,
      title: "GitHub",
      subtitle: "Code Repository",
      description: "Version Control & Collaboration",
      icon: <FaGithub className="w-5 h-5 text-white" />,
      image: "https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?q=80&w=1000&auto=format&fit=crop"
    },
    {
      id: 2,
      title: "LinkedIn",
      subtitle: "Professional Network",
      description: "Career & Connections",
      icon: <FaLinkedin className="w-5 h-5 text-white" />,
      image: "https://images.unsplash.com/photo-1611944212129-29977ae1398c?q=80&w=1000&auto=format&fit=crop"
    }
  ];

  return (
    <div className="main-content" style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>
      {/* Top Center Card */}
      <div style={{
        width: '100%',
        maxWidth: '700px',
        margin: '0 auto 32px auto',
        padding: '28px 36px',
        borderRadius: '24px',
        background: 'rgba(15, 17, 23, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '12px'
      }}>
        {/* User Name */}
        <h1 style={{
          fontSize: '32px',
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-0.02em',
          margin: 0,
          textShadow: '0 0 12px rgba(236, 72, 153, 0.4)'
        }}>
          {fullName}
        </h1>

        {/* Role / Post Badge */}
        <div style={{
          fontSize: '13px',
          fontWeight: 700,
          color: '#00FF66',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          background: 'rgba(0, 255, 102, 0.08)',
          border: '1px solid rgba(0, 255, 102, 0.2)',
          padding: '6px 16px',
          borderRadius: '9999px',
          textShadow: '0 0 10px rgba(0, 255, 102, 0.3)'
        }}>
          {role}
        </div>

        {/* Social Media Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px' }}>
          {linkedinUrl ? (
            <a
              href={linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '12px',
                background: 'rgba(0, 119, 181, 0.15)',
                border: '1px solid rgba(0, 119, 181, 0.4)',
                color: '#38bdf8',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <FaLinkedin size={18} />
              <span>LinkedIn</span>
            </a>
          ) : null}

          {githubUrl ? (
            <a
              href={githubUrl.startsWith('http') ? githubUrl : `https://${githubUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <FaGithub size={18} />
              <span>GitHub</span>
            </a>
          ) : null}
        </div>
      </div>

      {/* Tech Stack Staggered Grid */}
      <div style={{ width: '100%' }}>
        <StaggeredGrid
          centerText="TECH STACK"
          images={techStack}
          bentoItems={defaultBentoItems}
          showFooter={false}
        />
      </div>
    </div>
  );
}
