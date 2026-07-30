import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Check, Plus, X, User, Edit3, Sparkles } from 'lucide-react';
import { FaLinkedin, FaGithub } from 'react-icons/fa';
import { getTechIconUrl } from '../utils/techIcons';
import { FloatingIconsHero } from '../components/ui/floating-icons-hero-section';
import './Profile.css';

const PREDEFINED_TECH = {
  "Languages": ["Python", "JavaScript", "TypeScript", "Rust", "Go", "C++", "HTML/CSS", "Solidity"],
  "Frameworks": ["React", "Next.js", "FastAPI", "Django", "Node.js", "Express", "Svelte", "Flask"],
  "Databases": ["PostgreSQL", "Supabase", "MongoDB", "Redis", "MySQL", "DynamoDB"],
  "AI/ML": ["PyTorch", "TensorFlow", "OpenAI API", "Hugging Face", "LangChain", "Gemini API"],
  "Tools": ["Docker", "Kubernetes", "Git", "AWS", "GitHub Actions", "Vercel"]
};

export default function Profile() {
  const { profile, refreshProfile, API_BASE, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [isEditMode, setIsEditMode] = useState(searchParams.get('edit') === 'true');

  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('Frontend Developer');
  const [experience, setExperience] = useState('Intermediate');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTech, setSelectedTech] = useState([]);
  const [customTech, setCustomTech] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setIsEditMode(searchParams.get('edit') === 'true');
  }, [searchParams]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setRole(profile.primary_role || 'Frontend Developer');
      setExperience(profile.experience_level || 'Intermediate');
      setSelectedTech(profile.tech_stack || []);
      setLinkedinUrl(profile.linkedin_url || '');
      setGithubUrl(profile.github_url || '');
    }
  }, [profile]);

  const toggleMode = (edit) => {
    setIsEditMode(edit);
    if (edit) {
      setSearchParams({ edit: 'true' });
    } else {
      setSearchParams({});
    }
  };

  const handleTechSelect = (tech) => {
    if (!selectedTech.includes(tech)) {
      setSelectedTech([...selectedTech, tech]);
    }
  };

  const handleTechRemove = (tech) => {
    setSelectedTech(selectedTech.filter(t => t !== tech));
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    if (customTech.trim() && !selectedTech.includes(customTech.trim())) {
      setSelectedTech([...selectedTech, customTech.trim()]);
      setCustomTech('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      alert("Name is required.");
      return;
    }
    
    setUpdating(true);
    try {
      await axios.post(`${API_BASE}/profiles`, {
        id: user.id,
        full_name: fullName,
        primary_role: role,
        experience_level: experience,
        tech_stack: selectedTech,
        linkedin_url: linkedinUrl,
        github_url: githubUrl
      });
      await refreshProfile();
      alert("Profile updated successfully!");
      toggleMode(false);
    } catch (err) {
      console.error('Error saving profile:', err);
      alert("Error updating profile.");
    } finally {
      setUpdating(false);
    }
  };

  const userInitials = fullName
    ? fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const defaultTechs = ["Python", "JavaScript", "TypeScript", "React", "Next.js", "FastAPI", "PostgreSQL", "Supabase", "Docker", "Git", "PyTorch", "Tailwind", "C++"];
  const displayTechs = selectedTech.length > 0 ? selectedTech : defaultTechs;

  const floatingPositions = [
    { top: '10%', left: '8%' }, { top: '15%', right: '10%' }, { top: '35%', left: '5%' },
    { top: '38%', right: '6%' }, { bottom: '18%', left: '8%' }, { bottom: '15%', right: '10%' },
    { top: '8%', left: '30%' }, { top: '8%', right: '30%' }, { bottom: '10%', left: '28%' },
    { bottom: '10%', right: '28%' }, { top: '55%', left: '12%' }, { top: '58%', right: '12%' },
    { top: '25%', left: '20%' }, { top: '25%', right: '20%' }
  ];

  // Cap the floating icons to the number of available positions to prevent stacking
  const maxIcons = Math.min(displayTechs.length, floatingPositions.length);
  const iconsData = displayTechs.slice(0, maxIcons).map((tech, i) => ({
    id: i,
    icon: getTechIconUrl(tech),
    className: '',
    position: floatingPositions[i]
  }));

  return (
    <div className="profile-page-wrapper">
      {/* Top Header & Mode Switcher */}
      <div className="profile-top-header">
        <div>
          <h1 className="profile-title">
            <span>{isEditMode ? 'Edit Profile' : 'User Profile'}</span>
            <Sparkles size={22} style={{ color: '#c084fc' }} />
          </h1>
          <p className="profile-subtitle">
            {isEditMode 
              ? 'Update your bio, tech stack, and social connections' 
              : 'Overview of your developer identity and integrated tech stack'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="profile-tab-switcher">
          <button
            type="button"
            onClick={() => toggleMode(false)}
            className={`profile-tab-btn ${!isEditMode ? 'active' : ''}`}
          >
            <User size={15} />
            <span>View Profile</span>
          </button>

          <button
            type="button"
            onClick={() => toggleMode(true)}
            className={`profile-tab-btn ${isEditMode ? 'active' : ''}`}
          >
            <Edit3 size={15} />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* VIEW PROFILE PAGE */}
      {!isEditMode ? (
        <FloatingIconsHero icons={iconsData}>
          {/* Center Identity Card */}
          <div className="profile-hero-card">
            {/* Name */}
            <h2 className="profile-name">
              {fullName || "Anonymous Hackathoner"}
            </h2>

            {/* Role & Experience Pills */}
            <div className="profile-pills-row">
              <span className="profile-pill-role">
                {role}
              </span>
              <span className="profile-pill-exp">
                {experience}
              </span>
            </div>

            {/* Social Buttons Row Just Below Role */}
            <div className="profile-socials-row">
              {linkedinUrl ? (
                <a
                  href={linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="profile-social-btn linkedin"
                >
                  <FaLinkedin size={18} />
                  <span>LinkedIn Profile</span>
                </a>
              ) : (
                <div className="profile-social-btn disabled">
                  <FaLinkedin size={18} />
                  <span>LinkedIn Not Connected</span>
                </div>
              )}

              {githubUrl ? (
                <a
                  href={githubUrl.startsWith('http') ? githubUrl : `https://${githubUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="profile-social-btn github"
                >
                  <FaGithub size={18} />
                  <span>GitHub Profile</span>
                </a>
              ) : (
                <div className="profile-social-btn disabled">
                  <FaGithub size={18} />
                  <span>GitHub Not Connected</span>
                </div>
              )}
            </div>
          </div>
        </FloatingIconsHero>
      ) : (
        /* EDIT PROFILE FORM PAGE */
        <div className="profile-edit-card">
          <form onSubmit={handleSubmit} className="profile-form">
            
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#c084fc', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                /// PERSONAL IDENTITY
              </span>
            </div>

            {/* Full Name */}
            <div className="profile-form-group">
              <label className="profile-form-label">Full Name</label>
              <input
                type="text"
                className="profile-form-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Yash Goyal"
                required
              />
            </div>

            {/* Social URLs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              <div className="profile-form-group">
                <label className="profile-form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FaLinkedin size={14} style={{ color: '#60a5fa' }} /> LinkedIn URL
                </label>
                <input
                  type="url"
                  className="profile-form-input"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                />
              </div>

              <div className="profile-form-group">
                <label className="profile-form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FaGithub size={14} style={{ color: '#ffffff' }} /> GitHub URL
                </label>
                <input
                  type="url"
                  className="profile-form-input"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username"
                />
              </div>
            </div>

            {/* Role & Experience */}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginTop: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#f472b6', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                /// ROLE & EXPERIENCE
              </span>
            </div>

            <div className="profile-form-group">
              <label className="profile-form-label">Primary Role</label>
              <select 
                className="profile-form-select"
                value={role} 
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="Frontend Developer">Frontend Developer</option>
                <option value="Backend Developer">Backend Developer</option>
                <option value="Full Stack Developer">Full Stack Developer</option>
                <option value="AI/ML Engineer">AI/ML Engineer</option>
                <option value="UI/UX Designer">UI/UX Designer</option>
                <option value="DevOps Engineer">DevOps Engineer</option>
                <option value="Research & Pitch">Research & Pitch</option>
              </select>
            </div>

            <div className="profile-form-group">
              <label className="profile-form-label">Experience Level</label>
              <select 
                className="profile-form-select"
                value={experience} 
                onChange={(e) => setExperience(e.target.value)}
              >
                <option value="Beginner">Beginner (1st/2nd Hackathon)</option>
                <option value="Intermediate">Intermediate (Experienced coder)</option>
                <option value="Advanced">Advanced (Hackathon winner / Professional)</option>
              </select>
            </div>

            {/* Tech Stack */}
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginTop: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#818cf8', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                /// TECH STACK SELECTION
              </span>
            </div>

            <div className="profile-form-group">
              <label className="profile-form-label">Search Technologies</label>
              <input
                type="text"
                className="profile-form-input"
                placeholder="Type technology name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <div style={{
                maxHeight: '180px',
                overflowY: 'auto',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '12px',
                backgroundColor: '#0c0a12',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginTop: '6px'
              }}>
                {Object.entries(PREDEFINED_TECH).map(([category, items]) => {
                  const filtered = items.filter(item => item.toLowerCase().includes(searchQuery.toLowerCase()));
                  if (filtered.length === 0) return null;
                  return (
                    <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', fontFamily: 'monospace', textTransform: 'uppercase' }}>{category}</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {filtered.map(tech => (
                          <button
                            key={tech}
                            type="button"
                            onClick={() => handleTechSelect(tech)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: selectedTech.includes(tech) ? '1px solid rgba(192, 132, 252, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                              backgroundColor: selectedTech.includes(tech) ? 'rgba(192, 132, 252, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                              color: selectedTech.includes(tech) ? '#ffffff' : '#9ca3af',
                              fontSize: '11px',
                              fontFamily: 'monospace',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            {tech}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Tech */}
            <div className="profile-form-group">
              <label className="profile-form-label">Add Custom Technology</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="profile-form-input"
                  style={{ flex: 1 }}
                  placeholder="e.g. Web3.js"
                  value={customTech}
                  onChange={(e) => setCustomTech(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleAddCustom}
                  style={{
                    padding: '0 20px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {/* Selected Tech Chips */}
            <div className="profile-form-group">
              <label className="profile-form-label">
                Selected ({selectedTech.length})
              </label>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '12px',
                backgroundColor: '#0c0a12',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                minHeight: '50px',
                alignItems: 'center'
              }}>
                {selectedTech.length === 0 ? (
                  <span style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>No skills selected yet.</span>
                ) : (
                  selectedTech.map(tech => (
                    <div
                      key={tech}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(192, 132, 252, 0.15)',
                        border: '1px solid rgba(192, 132, 252, 0.3)',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontFamily: 'monospace'
                      }}
                    >
                      <span>{tech}</span>
                      <X
                        size={14}
                        style={{ cursor: 'pointer', color: '#9ca3af' }}
                        onClick={() => handleTechRemove(tech)}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={updating}
              className="profile-submit-btn"
            >
              <Check size={18} />
              <span>{updating ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}