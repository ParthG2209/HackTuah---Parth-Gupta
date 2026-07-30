import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Check, Plus, X } from 'lucide-react';
import { FaLinkedin, FaGithub } from 'react-icons/fa';

const PREDEFINED_TECH = {
  "Languages": ["Python", "JavaScript", "TypeScript", "Rust", "Go", "C++", "HTML/CSS", "Solidity"],
  "Frameworks": ["React", "Next.js", "FastAPI", "Django", "Node.js", "Express", "Svelte", "Flask"],
  "Databases": ["PostgreSQL", "Supabase", "MongoDB", "Redis", "MySQL", "DynamoDB"],
  "AI/ML": ["PyTorch", "TensorFlow", "OpenAI API", "Hugging Face", "LangChain", "Gemini API"],
  "Tools": ["Docker", "Kubernetes", "Git", "AWS", "GitHub Actions", "Vercel"]
};

export default function Onboarding() {
  const { user, refreshProfile, API_BASE } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [role, setRole] = useState('Frontend Developer');
  const [experience, setExperience] = useState('Intermediate');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTech, setSelectedTech] = useState([]);
  const [customTech, setCustomTech] = useState('');

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
      navigate('/dashboard');
    } catch (err) {
      console.error('Error saving profile:', err);
      alert("Error saving profile. Please check backend connection.");
    }
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      width: '100vw',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px 20px',
      background: '#08090c'
    }}>
      <div className="glass-card" style={{ maxWidth: '600px', width: '100%', padding: '40px' }}>
        <h2 style={{ fontFamily: 'Outfit', fontSize: '32px', marginBottom: '8px', color: '#fff' }}>
          Create Your Profile
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '14px' }}>
          Setup your profile details so KAIROS can align roadmaps, coordinate teams, and delegate tasks to your skills.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Primary Role</label>
            <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="Frontend Developer">Frontend Developer</option>
              <option value="Backend Developer">Backend Developer</option>
              <option value="Full Stack Developer">Full Stack Developer</option>
              <option value="AI/ML Engineer">AI/ML Engineer</option>
              <option value="UI/UX Designer">UI/UX Designer</option>
              <option value="DevOps Engineer">DevOps Engineer</option>
              <option value="Research & Pitch">Research & Pitch</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Experience Level</label>
            <select className="form-select" value={experience} onChange={(e) => setExperience(e.target.value)}>
              <option value="Beginner">Beginner (1st/2nd Hackathon)</option>
              <option value="Intermediate">Intermediate (Experienced coder)</option>
              <option value="Advanced">Advanced (Hackathon winner / Professional)</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaLinkedin size={14} style={{ color: '#0077b5' }} /> LinkedIn Profile
              </label>
              <input
                type="url"
                className="form-input"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/username"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FaGithub size={14} style={{ color: '#fff' }} /> GitHub Profile
              </label>
              <input
                type="url"
                className="form-input"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Search & Select Tech Stack</label>
            <input
              type="text"
              className="form-input"
              placeholder="Search technologies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', padding: '10px', borderRadius: '0px', background: 'rgba(0,0,0,0.2)', marginTop: '8px' }}>
              {Object.entries(PREDEFINED_TECH).map(([category, items]) => {
                const filtered = items.filter(item => item.toLowerCase().includes(searchQuery.toLowerCase()));
                if (filtered.length === 0) return null;
                return (
                  <div key={category} style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#6b7280', fontWeight: 'bold', marginBottom: '4px' }}>{category}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {filtered.map(tech => (
                        <button
                          key={tech}
                          type="button"
                          onClick={() => handleTechSelect(tech)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '0px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: selectedTech.includes(tech) ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                            color: selectedTech.includes(tech) ? '#60a5fa' : '#d1d5db',
                            fontSize: '11px',
                            cursor: 'pointer'
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

          <div className="form-group">
            <label className="form-label">Add Custom Technology</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                style={{ flexGrow: 1 }}
                placeholder="e.g. Web3.js"
                value={customTech}
                onChange={(e) => setCustomTech(e.target.value)}
              />
              <button type="button" onClick={handleAddCustom} className="btn btn-secondary" style={{ padding: '0 16px' }}>
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Selected Technologies</label>
            <div className="tag-input-container">
              {selectedTech.length === 0 ? (
                <span style={{ fontSize: '12px', color: '#6b7280', padding: '4px' }}>No skills selected yet.</span>
              ) : (
                selectedTech.map(tech => (
                  <div key={tech} className="tag">
                    {tech}
                    <X size={12} className="tag-remove" onClick={() => handleTechRemove(tech)} />
                  </div>
                ))
              )}
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
            <Check size={18} /> Complete Onboarding
          </button>
        </form>
      </div>
    </div>
  );
}
