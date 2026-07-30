import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';

export default function MarkdownRenderer({ content = '' }) {
  if (!content) return null;

  // 1. Separate DeepSeek <think> tags from the main content
  let thinkingContent = '';
  let mainContent = content;

  const thinkStartIdx = content.indexOf('<think>');
  const thinkEndIdx = content.indexOf('</think>');

  if (thinkStartIdx !== -1) {
    if (thinkEndIdx !== -1) {
      thinkingContent = content.substring(thinkStartIdx + 7, thinkEndIdx).trim();
      mainContent = content.substring(thinkEndIdx + 8).trim();
    } else {
      // Still currently thinking (streaming)
      thinkingContent = content.substring(thinkStartIdx + 7).trim();
      mainContent = '';
    }
  }

  // 2. Parse the markdown text into HTML-like blocks manually
  // This is safe, performant, and has no dependency mismatch issues with React 19.
  const parseMarkdownToBlocks = (text) => {
    const lines = text.split('\n');
    const blocks = [];
    let currentList = null;
    let inCodeBlock = false;
    let codeBlockLines = [];

    const flushList = () => {
      if (currentList) {
        blocks.push({ type: 'list', items: currentList.items, ordered: currentList.ordered });
        currentList = null;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle Code Blocks
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          inCodeBlock = false;
          blocks.push({ type: 'code', code: codeBlockLines.join('\n') });
          codeBlockLines = [];
        } else {
          flushList();
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      const trimmed = line.trim();

      // Empty line -> paragraph break
      if (!trimmed) {
        flushList();
        continue;
      }

      // Headings
      if (trimmed.startsWith('# ')) {
        flushList();
        blocks.push({ type: 'h1', text: trimmed.substring(2) });
      } else if (trimmed.startsWith('## ')) {
        flushList();
        blocks.push({ type: 'h2', text: trimmed.substring(3) });
      } else if (trimmed.startsWith('### ')) {
        flushList();
        blocks.push({ type: 'h3', text: trimmed.substring(4) });
      }
      // Ordered List Item
      else if (/^\d+\.\s/.test(trimmed)) {
        const match = trimmed.match(/^(\d+)\.\s(.*)/);
        if (match) {
          const itemText = match[2];
          if (currentList && currentList.ordered) {
            currentList.items.push(itemText);
          } else {
            flushList();
            currentList = { ordered: true, items: [itemText] };
          }
        }
      }
      // Unordered List Item
      else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const itemText = trimmed.substring(2);
        if (currentList && !currentList.ordered) {
          currentList.items.push(itemText);
        } else {
          flushList();
          currentList = { ordered: false, items: [itemText] };
        }
      }
      // Blockquote
      else if (trimmed.startsWith('> ')) {
        flushList();
        blocks.push({ type: 'blockquote', text: trimmed.substring(2) });
      }
      // Normal Paragraph
      else {
        flushList();
        blocks.push({ type: 'p', text: line });
      }
    }

    flushList();
    return blocks;
  };

  // Helper to format inline bold, italic, and inline code
  const renderInlineText = (text) => {
    let keyCounter = 0;
    const elements = [];
    
    // Combine parsing for simple markdown inline
    const inlineRegex = /(\*\*.*?\*\*|`.*?`)/g;
    let match;
    let lastIndex = 0;
    
    while ((match = inlineRegex.exec(text)) !== null) {
      const matchText = match[0];
      const matchIndex = match.index;
      
      // text before match
      if (matchIndex > lastIndex) {
        elements.push(<span key={`text-${keyCounter++}`}>{text.substring(lastIndex, matchIndex)}</span>);
      }
      
      if (matchText.startsWith('**') && matchText.endsWith('**')) {
        elements.push(
          <strong key={`bold-${keyCounter++}`} style={{ color: '#fff', fontWeight: '600' }}>
            {matchText.slice(2, -2)}
          </strong>
        );
      } else if (matchText.startsWith('`') && matchText.endsWith('`')) {
        elements.push(
          <code key={`code-${keyCounter++}`} style={{
            background: 'rgba(255,255,255,0.08)',
            padding: '2px 6px',
            borderRadius: '0px',
            fontFamily: 'monospace',
            fontSize: '90%',
            color: '#34d399'
          }}>
            {matchText.slice(1, -1)}
          </code>
        );
      }
      
      lastIndex = inlineRegex.lastIndex;
    }
    
    if (lastIndex < text.length) {
      elements.push(<span key={`text-${keyCounter++}`}>{text.substring(lastIndex)}</span>);
    }

    return elements.length > 0 ? elements : text;
  };

  const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);

  const renderBlock = (block, idx) => {
    switch (block.type) {
      case 'h1':
        return <h1 key={idx} style={{ fontSize: '24px', fontWeight: '700', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px', marginTop: '24px', marginBottom: '16px' }}>{renderInlineText(block.text)}</h1>;
      case 'h2':
        return <h2 key={idx} style={{ fontSize: '18px', fontWeight: '600', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px', marginTop: '20px', marginBottom: '12px' }}>{renderInlineText(block.text)}</h2>;
      case 'h3':
        return <h3 key={idx} style={{ fontSize: '15px', fontWeight: '600', color: '#e5e7eb', marginTop: '16px', marginBottom: '8px' }}>{renderInlineText(block.text)}</h3>;
      case 'p':
        return <p key={idx} style={{ fontSize: '13.5px', lineHeight: '1.6', color: '#d1d5db', marginBottom: '14px' }}>{renderInlineText(block.text)}</p>;
      case 'blockquote':
        return (
          <blockquote key={idx} style={{ borderLeft: '4px solid #8b5cf6', paddingLeft: '16px', marginLeft: 0, marginY: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
            {renderInlineText(block.text)}
          </blockquote>
        );
      case 'list':
        const ListTag = block.ordered ? 'ol' : 'ul';
        return (
          <ListTag key={idx} style={{ paddingLeft: '20px', marginBottom: '14px', listStyleType: block.ordered ? 'decimal' : 'disc' }}>
            {block.items.map((item, itemIdx) => (
              <li key={itemIdx} style={{ fontSize: '13.5px', lineHeight: '1.6', color: '#d1d5db', marginBottom: '6px' }}>
                {renderInlineText(item)}
              </li>
            ))}
          </ListTag>
        );
      case 'code':
        return (
          <pre key={idx} style={{
            background: '#090d16',
            border: '1px solid rgba(255,255,255,0.05)',
            padding: '16px',
            borderRadius: '0px',
            overflowX: 'auto',
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#34d399',
            marginBottom: '16px',
            whiteSpace: 'pre-wrap'
          }}>
            {block.code}
          </pre>
        );
      default:
        return null;
    }
  };

  const parsedMainBlocks = parseMarkdownToBlocks(mainContent);

  return (
    <div className="premium-document-renderer" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* DeepSeek R1 Collapsible Thinking Block */}
      {thinkingContent && (
        <div style={{
          background: 'rgba(139, 92, 246, 0.05)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '0px',
          marginBottom: '20px',
          overflow: 'hidden',
          transition: 'all 0.3s ease'
        }}>
          <button
            onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              background: 'rgba(139, 92, 246, 0.08)',
              border: 'none',
              color: '#c084fc',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Brain size={16} style={{ animation: thinkEndIdx === -1 ? 'pulse 2s infinite' : 'none' }} />
              <span>{thinkEndIdx === -1 ? 'KAIROS is thinking...' : 'View thinking process'}</span>
            </div>
            {isThinkingExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          
          {isThinkingExpanded && (
            <div style={{
              padding: '16px',
              borderTop: '1px solid rgba(139, 92, 246, 0.1)',
              background: 'rgba(0,0,0,0.2)',
              maxHeight: '250px',
              overflowY: 'auto',
              fontSize: '12.5px',
              color: '#a78bfa',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.5'
            }}>
              {thinkingContent}
            </div>
          )}
        </div>
      )}

      {/* Main Document Content */}
      <div className="document-body">
        {parsedMainBlocks.length > 0 ? (
          parsedMainBlocks.map((block, idx) => renderBlock(block, idx))
        ) : (
          <p style={{ color: '#6b7280', fontStyle: 'italic', fontSize: '13px' }}>Waiting for response content...</p>
        )}
      </div>
    </div>
  );
}
