import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, MessageSquare, CheckSquare,
  Presentation, Layout, User, LogOut, Menu, X
} from 'lucide-react';

export default function Sidebar() {
  const { logout, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => setIsOpen(false);

  return (
    <div className="sidebar-container-kairos">
      {/* Mobile Top Navbar */}
      <div className="mobile-header-kairos">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="sidebar-logo-circle" style={{ width: '36px', height: '36px', boxShadow: 'none' }}>
            <img src="/kairos_logo.jpeg" alt="Logo" className="sidebar-logo-img" />
          </div>
          <span style={{ fontWeight: '800', fontSize: '18px', color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>KAIROS</span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation Dropdown Overlay */}
      {isOpen && (
        <div className="mobile-nav-dropdown">
          <div className="mobile-links-wrapper">
            <NavLink to="/dashboard" onClick={closeMenu} className="mobile-link-item">
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/teams" onClick={closeMenu} className="mobile-link-item">
              <Users size={18} />
              <span>Teams</span>
            </NavLink>
            <NavLink to="/coach" onClick={closeMenu} className="mobile-link-item">
              <MessageSquare size={18} />
              <span>Coach Room</span>
            </NavLink>
            <NavLink to="/tasks" onClick={closeMenu} className="mobile-link-item">
              <CheckSquare size={18} />
              <span>Task Board</span>
            </NavLink>
            <NavLink to="/pitch" onClick={closeMenu} className="mobile-link-item">
              <Presentation size={18} />
              <span>Pitch Deck</span>
            </NavLink>
            <NavLink to="/presentation" onClick={closeMenu} className="mobile-link-item">
              <Layout size={18} />
              <span>Presentation Studio</span>
            </NavLink>
            <NavLink to="/profile" onClick={closeMenu} className="mobile-link-item">
              <User size={18} />
              <span>My Profile</span>
            </NavLink>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '12px 0' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="sidebar-user-avatar" style={{ border: 'none' }}>{userInitials}</div>
                <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>{profile?.full_name || 'User'}</span>
              </div>
              {
                <button
                  onClick={() => { closeMenu(); logout(); }}
                  style={{ background: 'transparent', border: 'none', color: '#f87171', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              }
            </div>
          </div>
        </div>
      )}

      {/* Desktop capsule sidebar */}
      <div className="sidebar-bar-kairos desktop-only">
        {/* Nav Links */}
        <div className="sidebar-links-wrapper">
          <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link-kairos ${isActive ? 'active' : ''}`}>
            <div className="icon-wrapper">
              <LayoutDashboard size={20} />
            </div>
            <span className="sidebar-label">Dashboard</span>
          </NavLink>

          <NavLink to="/teams" className={({ isActive }) => `sidebar-link-kairos ${isActive ? 'active' : ''}`}>
            <div className="icon-wrapper">
              <Users size={20} />
            </div>
            <span className="sidebar-label">Teams</span>
          </NavLink>

          <NavLink to="/coach" className={({ isActive }) => `sidebar-link-kairos ${isActive ? 'active' : ''}`}>
            <div className="icon-wrapper">
              <MessageSquare size={20} />
            </div>
            <span className="sidebar-label">Coach Room</span>
          </NavLink>

          <NavLink to="/tasks" className={({ isActive }) => `sidebar-link-kairos ${isActive ? 'active' : ''}`}>
            <div className="icon-wrapper">
              <CheckSquare size={20} />
            </div>
            <span className="sidebar-label">Task Board</span>
          </NavLink>

          <NavLink to="/pitch" className={({ isActive }) => `sidebar-link-kairos ${isActive ? 'active' : ''}`}>
            <div className="icon-wrapper">
              <Presentation size={20} />
            </div>
            <span className="sidebar-label">Pitch Deck</span>
          </NavLink>

          <NavLink to="/presentation" className={({ isActive }) => `sidebar-link-kairos ${isActive ? 'active' : ''}`}>
            <div className="icon-wrapper">
              <Layout size={20} />
            </div>
            <span className="sidebar-label">Presentation Studio</span>
          </NavLink>

          <NavLink to="/profile" className={({ isActive }) => `sidebar-link-kairos ${isActive ? 'active' : ''}`}>
            <div className="icon-wrapper">
              <User size={20} />
            </div>
            <span className="sidebar-label">My Profile</span>
          </NavLink>
        </div>

        {/* Footer Actions */}
        <div className="sidebar-footer-kairos">
          {/* Sign Out */}
          {profile && (
            <button
              onClick={logout}
              className="sidebar-link-kairos logout-btn"
              title="Sign Out"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <div className="icon-wrapper">
                <LogOut size={20} />
              </div>
              <span className="sidebar-label">Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
