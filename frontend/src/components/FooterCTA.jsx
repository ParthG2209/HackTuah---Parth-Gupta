import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './FooterCTA.css';

export default function FooterCTA() {
  const navigate = useNavigate();
  const { user, loginWithGoogle } = useAuth();

  return (
    <footer className="kairos-footer">
      {/* ── Aurora Background ── */}
      <div className="footer-aurora">
        <div className="footer-aurora-blob footer-aurora-1"></div>
        <div className="footer-aurora-blob footer-aurora-2"></div>
        <div className="footer-aurora-blob footer-aurora-3"></div>
      </div>

      {/* ── Top Nav Grid ── */}
      <div className="footer-nav">
        <div className="footer-nav-group">
          <span className="footer-nav-heading">Product</span>
          <a href="#" className="footer-nav-link">Dashboard</a>
          <a href="#" className="footer-nav-link">Pitch Deck</a>
          <a href="#" className="footer-nav-link">Kanban Board</a>
          <a href="#" className="footer-nav-link">AI Engine</a>
        </div>
        <div className="footer-nav-group">
          <span className="footer-nav-heading">Resources</span>
          <a href="#" className="footer-nav-link">Documentation</a>
          <a href="#" className="footer-nav-link">Architecture</a>
          <a href="#" className="footer-nav-link">System Status</a>
          <a href="#" className="footer-nav-link">Changelog</a>
        </div>
        <div className="footer-nav-group">
          <span className="footer-nav-heading">Company</span>
          <a href="#" className="footer-nav-link">About</a>
          <a href="#" className="footer-nav-link">Contact</a>
          <a href="#" className="footer-nav-link">GitHub</a>
        </div>
        <div className="footer-nav-cta">
          <p className="footer-tagline">Orchestrate your vision.</p>
          <p className="footer-copyright">
            © {new Date().getFullYear()} KAIROS. All rights reserved.
          </p>
          <button
            className="footer-start-btn"
            onClick={() => user ? navigate('/dashboard') : loginWithGoogle()}
          >
            Get Started →
          </button>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="footer-divider" />

      {/* ── Giant Wordmark ── */}
      <div className="footer-wordmark-wrapper">
        <span className="footer-wordmark">
          KAIROS
          <span className="wordmark-dots">
            <span className="wordmark-dot"></span>
            <span className="wordmark-dot"></span>
            <span className="wordmark-dot"></span>
          </span>
        </span>
      </div>
    </footer>
  );
}
