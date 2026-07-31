import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  Presentation as PresentationIcon, Loader, Download, Upload, CheckCircle2, 
  FileText, Layout, ChevronLeft, ChevronRight, Eye, RefreshCw, ImageIcon
} from 'lucide-react';

export default function PresentationStudio() {
  const { profile, API_BASE } = useAuth();
  
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Template States
  const [selectedTemplate, setSelectedTemplate] = useState('template-1');
  const [customFile, setCustomFile] = useState(null);
  const [customAnalysis, setCustomAnalysis] = useState(null);
  const [isAnalyzingCustom, setIsAnalyzingCustom] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Slide Preview Images from backend
  const [slideImages, setSlideImages] = useState([]);
  const [previewRenderer, setPreviewRenderer] = useState('fallback');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const previewRequestRef = useRef(0);

  const builtInTemplates = [
    { 
      id: 'template-1', 
      name: 'Cyber Neon Executive (Template 1)', 
      desc: 'Dark theme with purple glow & master tech card boxes', 
      slides: 10,
      accentColor: '#a855f7',
      borderColor: 'rgba(168,85,247,0.4)'
    },
    { 
      id: 'template-2', 
      name: 'Minimalist Modern Tech (Template 2)', 
      desc: 'Clean, sleek layout with crisp typography & grid cards', 
      slides: 11,
      accentColor: '#38bdf8',
      borderColor: 'rgba(56,189,248,0.4)'
    },
    { 
      id: 'template-3', 
      name: 'Vibrant Launchpad (Template 3)', 
      desc: 'Dynamic pitch design with prominent master metric boxes', 
      slides: 11,
      accentColor: '#f43f5e',
      borderColor: 'rgba(244,63,94,0.4)'
    },
    { 
      id: 'template-4', 
      name: 'Enterprise Architecture (Template 4)', 
      desc: 'Comprehensive technical & workflow flowchart deck', 
      slides: 13,
      accentColor: '#34d399',
      borderColor: 'rgba(52,211,153,0.4)'
    },
    { 
      id: 'template-5', 
      name: 'Futuristic AI Studio (Template 5)', 
      desc: 'Obsidian gradient style for AI presentations & showcase', 
      slides: 10,
      accentColor: '#c084fc',
      borderColor: 'rgba(192,132,252,0.4)'
    }
  ];

  const fetchSessions = useCallback(async () => {
    if (!profile) return;
    try {
      const res = await axios.get(`${API_BASE}/sessions`, {
        params: { profile_id: profile.id }
      });
      const planSessions = res.data.filter(s => s.status === 'execution' || s.status === 'completed' || s.status === 'planning');
      setSessions(planSessions);
      if (planSessions.length > 0 && !activeSessionId) {
        setActiveSessionId(planSessions[0].id);
      }
    } catch (e) {
      console.error("Error loading sessions for presentation studio:", e);
    }
  }, [profile, API_BASE, activeSessionId]);

  const fetchSessionDetails = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const res = await axios.get(`${API_BASE}/sessions/${activeSessionId}`);
      setActiveSession(res.data);
    } catch (e) {
      console.error("Error loading presentation details:", e);
    }
  }, [activeSessionId, API_BASE]);

  // Fetch preview slide images from backend
  const fetchPreviewSlides = useCallback(async () => {
    if (!activeSessionId) return;
    const requestId = ++previewRequestRef.current;
    setIsLoadingPreview(true);
    setPreviewError(null);
    setActiveSlideIndex(0);

    try {
      const formData = new FormData();
      if (selectedTemplate === 'custom' && customFile) {
        formData.append('file', customFile);
      } else {
        formData.append('template_id', selectedTemplate);
      }

      const res = await axios.post(
        `${API_BASE}/sessions/${activeSessionId}/pitch/preview-slides`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }
      );

      // A template switch can leave an older request in flight. Only the most
      // recent response is allowed to replace the active preview.
      if (requestId === previewRequestRef.current && res.data && res.data.slides) {
        setSlideImages(res.data.slides);
        setPreviewRenderer(res.data.renderer || 'fallback');
      }
    } catch (err) {
      console.error("Error loading preview slides:", err);
      if (requestId === previewRequestRef.current) {
        setPreviewError(err.response?.data?.detail || "Failed to generate preview. Please try again.");
        setSlideImages([]);
      }
    } finally {
      if (requestId === previewRequestRef.current) setIsLoadingPreview(false);
    }
  }, [activeSessionId, selectedTemplate, customFile, API_BASE]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    fetchSessionDetails();
  }, [fetchSessionDetails]);

  // Auto-fetch preview when session or template changes
  useEffect(() => {
    if (activeSessionId && selectedTemplate) {
      fetchPreviewSlides();
    }
  }, [activeSessionId, selectedTemplate, customFile, fetchPreviewSlides]);

  const handleCustomFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pptx')) {
      alert('Please upload a valid .pptx presentation file.');
      return;
    }

    setCustomFile(file);
    setIsAnalyzingCustom(true);
    setCustomAnalysis(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_BASE}/sessions/${activeSessionId}/pitch/analyze-custom-template`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setCustomAnalysis(res.data.analysis);
      setSelectedTemplate('custom');
    } catch (err) {
      console.error("Error analyzing custom template:", err);
      alert("Failed to analyze uploaded PPTX template.");
    } finally {
      setIsAnalyzingCustom(false);
    }
  };

  const handleDownloadPPTX = async () => {
    if (!activeSessionId) return;
    setIsDownloading(true);

    try {
      const formData = new FormData();
      if (selectedTemplate === 'custom' && customFile) {
        formData.append('file', customFile);
      } else {
        formData.append('template_id', selectedTemplate);
      }

      const res = await axios.post(`${API_BASE}/sessions/${activeSessionId}/pitch/export-pptx`, formData, {
        responseType: 'blob',
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${activeSession?.name || 'KAIROS'}_Presentation.pptx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Error downloading PPTX:", err);
      alert("Failed to download PPTX file.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!activeSessionId) return;
    setIsDownloading(true);

    try {
      const res = await axios.post(`${API_BASE}/sessions/${activeSessionId}/pitch/export-pdf`, {}, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${activeSession?.name || 'KAIROS'}_Presentation.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Error downloading PDF:", err);
      alert("Failed to download PDF file.");
    } finally {
      setIsDownloading(false);
    }
  };

  const activeT = selectedTemplate === 'custom'
    ? { accentColor: '#34d399', borderColor: 'rgba(52,211,153,0.4)' }
    : builtInTemplates.find(t => t.id === selectedTemplate) || builtInTemplates[0];

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1, overflowY: 'auto', paddingBottom: '60px' }}>
      {/* Top Header */}
      <div className="dashboard-header" style={{ marginBottom: '4px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <PresentationIcon size={32} style={{ color: '#a855f7' }} /> Presentation Studio & Live PPTX Preview
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px' }}>
            Preview the <strong style={{ color: '#c084fc' }}>exact PPTX</strong> that will be downloaded. Switch templates and see real slide renders instantly.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            onClick={handleDownloadPPTX} 
            disabled={isDownloading || !activeSessionId} 
            className="btn btn-primary" 
            style={{ padding: '12px 20px', fontSize: '14px', background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', boxShadow: '0 4px 14px rgba(168,85,247,0.4)' }}
          >
            <Download size={16} /> {isDownloading ? 'Exporting...' : 'Download .PPTX'}
          </button>
          
          <button 
            onClick={handleDownloadPDF} 
            disabled={isDownloading || !activeSessionId} 
            className="btn btn-secondary" 
            style={{ padding: '12px 20px', fontSize: '14px' }}
          >
            <FileText size={16} /> Download .PDF
          </button>
        </div>
      </div>

      {/* Session Switcher Header Bar */}
      <div className="glass-card" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 600 }}>Active Project Session:</span>
          <select 
            className="form-input" 
            style={{ padding: '8px 16px', minWidth: '240px', background: 'rgba(0,0,0,0.4)' }}
            value={activeSessionId}
            onChange={(e) => setActiveSessionId(e.target.value)}
          >
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchPreviewSlides} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '13px' }}>
            <RefreshCw size={14} /> Refresh Preview
          </button>
        </div>
      </div>

      {/* Slide Template Selection Bar */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Layout size={18} style={{ color: '#c084fc' }} /> Slide Template Engine (Master `.pptx` Files Preserved)
            </h3>
            <p style={{ color: '#9ca3af', fontSize: '12px', margin: '4px 0 0 0' }}>
              Select a template below. The preview shows the <strong style={{ color: '#e2e8f0' }}>exact rendered PPTX</strong> — what you see is what you download.
            </p>
          </div>

          <label className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={14} />
            {isAnalyzingCustom ? 'Analyzing...' : 'Upload Custom .PPTX'}
            <input type="file" accept=".pptx" onChange={handleCustomFileUpload} style={{ display: 'none' }} disabled={isAnalyzingCustom} />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
          {builtInTemplates.map(t => (
            <div
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              style={{
                padding: '14px',
                borderRadius: '0px',
                border: selectedTemplate === t.id ? `2px solid ${t.accentColor}` : '1px solid rgba(255,255,255,0.06)',
                background: selectedTemplate === t.id ? 'rgba(168,85,247,0.15)' : 'rgba(0,0,0,0.25)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: selectedTemplate === t.id ? `0 0 16px ${t.accentColor}40` : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{t.name}</span>
                {selectedTemplate === t.id && <CheckCircle2 size={16} style={{ color: t.accentColor }} />}
              </div>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 8px 0', lineHeight: '1.4' }}>{t.desc}</p>
              <span style={{ fontSize: '10px', color: t.accentColor, background: `${t.accentColor}20`, padding: '3px 8px', borderRadius: '0px', fontWeight: 600 }}>
                {t.slides} Slides
              </span>
            </div>
          ))}

          {customFile && (
            <div
              onClick={() => setSelectedTemplate('custom')}
              style={{
                padding: '14px',
                borderRadius: '0px',
                border: selectedTemplate === 'custom' ? '2px solid #34d399' : '1px solid rgba(255,255,255,0.06)',
                background: selectedTemplate === 'custom' ? 'rgba(52,211,153,0.15)' : 'rgba(0,0,0,0.25)',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#34d399', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {customFile.name}
                </span>
                {selectedTemplate === 'custom' && <CheckCircle2 size={16} style={{ color: '#34d399' }} />}
              </div>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 8px 0' }}>Uploaded PPTX Template</p>
              {customAnalysis && (
                <span style={{ fontSize: '10px', color: '#34d399', background: 'rgba(52,211,153,0.2)', padding: '3px 8px', borderRadius: '0px', fontWeight: 600 }}>
                  Mapped {customAnalysis.slide_count} Slides
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Slide Preview Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '12px', flexGrow: 1 }}>
        
        {/* Left Pane - Slide Thumbnails */}
        <div className="glass-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '620px', overflowY: 'auto' }}>
          <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#a1a1aa', letterSpacing: '0.05em', margin: '0 0 4px 0', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ImageIcon size={13} />
            Slides ({slideImages.length || '—'})
          </h4>

          {isLoadingPreview && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '20px 0' }}>
              <Loader size={20} style={{ color: '#a855f7', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Rendering slides...</span>
            </div>
          )}

          {!isLoadingPreview && slideImages.map((b64, idx) => (
            <div
              key={idx}
              onClick={() => setActiveSlideIndex(idx)}
              style={{
                padding: '3px',
                borderRadius: '0px',
                border: activeSlideIndex === idx ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
                background: activeSlideIndex === idx ? 'rgba(168,85,247,0.12)' : 'rgba(0,0,0,0.15)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <img
                src={`data:image/png;base64,${b64}`}
                alt={`Slide ${idx + 1}`}
                style={{
                  width: '100%',
                  borderRadius: '0px',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
              <div style={{ textAlign: 'center', padding: '2px 0' }}>
                <span style={{ fontSize: '9px', color: activeSlideIndex === idx ? '#c084fc' : '#71717a', fontWeight: 600 }}>
                  Slide {idx + 1}
                </span>
              </div>
            </div>
          ))}

          {!isLoadingPreview && slideImages.length === 0 && !previewError && (
            <div style={{ padding: '20px 8px', textAlign: 'center' }}>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>Select a session & template to preview slides.</p>
            </div>
          )}
        </div>

        {/* Right Pane - Full Slide Image Preview */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '20px', minHeight: '540px' }}>
          
          {/* Slide Navigation Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={18} style={{ color: activeT.accentColor }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                {slideImages.length > 0 
                  ? <>Slide {activeSlideIndex + 1} of {slideImages.length} — <span style={{ color: activeT.accentColor }}>Exact PPTX Preview</span></>
                  : <span style={{ color: '#9ca3af' }}>No Preview Available</span>
                }
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                onClick={() => setActiveSlideIndex(prev => Math.max(0, prev - 1))}
                disabled={activeSlideIndex === 0 || slideImages.length === 0}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button 
                onClick={() => setActiveSlideIndex(prev => Math.min(slideImages.length - 1, prev + 1))}
                disabled={activeSlideIndex >= slideImages.length - 1 || slideImages.length === 0}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Slide Image Display */}
          <div 
            style={{
              width: '100%',
              flexGrow: 1,
              background: '#0a0a0f',
              borderRadius: '0px',
              border: `1px solid ${activeT.borderColor}`,
              boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '400px'
            }}
          >
            {isLoadingPreview && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <Loader size={36} style={{ color: '#a855f7', animation: 'spin 1s linear infinite' }} />
                <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 500 }}>Generating exact PPTX preview...</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>This renders the real template with your project data</span>
              </div>
            )}

            {previewError && !isLoadingPreview && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px', color: '#f87171' }}>{previewError}</span>
                <button onClick={fetchPreviewSlides} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                  <RefreshCw size={14} /> Retry Preview
                </button>
              </div>
            )}

            {!isLoadingPreview && !previewError && slideImages.length > 0 && slideImages[activeSlideIndex] && (
              <img
                src={`data:image/png;base64,${slideImages[activeSlideIndex]}`}
                alt={`Slide ${activeSlideIndex + 1} Preview`}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: '0px'
                }}
              />
            )}

            {!isLoadingPreview && !previewError && slideImages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <PresentationIcon size={48} style={{ color: '#2a2438' }} />
                <span style={{ fontSize: '14px', color: '#64748b' }}>Select a session to preview your presentation</span>
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {previewRenderer === 'native'
                ? '✓ Native render of the exact PPTX that will be downloaded'
                : '✓ Template content preview; install LibreOffice for native PPTX rendering'}
            </span>
            <span style={{ fontSize: '11px', color: activeT.accentColor, fontWeight: 600 }}>
              {slideImages.length > 0 ? `${slideImages.length} slides rendered` : ''}
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}
