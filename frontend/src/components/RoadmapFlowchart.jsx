import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Download, Minimize2, Maximize2, ChevronDown, RefreshCcw
} from 'lucide-react';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MarkerType,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { toPng, toJpeg, toSvg } from 'html-to-image';
import MilestoneNode from './MilestoneNode';

const nodeTypes = {
  milestone: MilestoneNode,
};

const getPhaseColor = (idx) => {
  const colors = ['#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#10b981'];
  return colors[idx % colors.length] || '#f59e0b';
};

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // Approximate dimensions for our MilestoneNode
  const nodeWidth = 320;
  const nodeHeight = 300; 

  dagreGraph.setGraph({ rankdir: direction, nodesep: 50, ranksep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = { ...node };
    
    // Shift position to top left for React Flow
    newNode.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
    return newNode;
  });

  return { nodes: newNodes, edges };
};

const Flow = ({ roadmap, tasks, blockers, onNodeClick, isFullscreen, setIsFullscreen, handleDownload }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [expandedPhases, setExpandedPhases] = useState({});

  const toggleExpand = useCallback((idx) => {
    setExpandedPhases(prev => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  useEffect(() => {
    if (!roadmap || roadmap.length === 0) return;

    const initialNodes = [];
    const initialEdges = [];

    roadmap.forEach((milestone, mIdx) => {
      const phaseName = milestone?.phase || `Phase ${mIdx + 1}`;
      const phaseKey = String(phaseName).toLowerCase().replace(' ', '_');
      const phaseColor = getPhaseColor(mIdx);
      
      const milestoneTasks = (tasks || []).filter(t => 
        t.milestone_id?.toLowerCase() === phaseKey || 
        t.milestone_id?.toLowerCase() === `phase_${mIdx + 1}`
      );
      
      const milestoneBlockers = (blockers || []).filter(b => 
        milestoneTasks.some(t => t.id === b.task_id)
      );

      const nodeId = `node-${mIdx}`;

      initialNodes.push({
        id: nodeId,
        type: 'milestone',
        position: { x: 0, y: 0 }, // Handled by dagre
        data: {
          milestone,
          tasks: milestoneTasks,
          blockers: milestoneBlockers,
          isExpanded: expandedPhases[mIdx] || false,
          toggleExpand: toggleExpand,
          phaseColor,
          index: mIdx
        }
      });

      // Simple linear linking if no complex dependencies exist
      if (mIdx > 0) {
        initialEdges.push({
          id: `edge-${mIdx - 1}-${mIdx}`,
          source: `node-${mIdx - 1}`,
          target: nodeId,
          type: 'smoothstep',
          animated: true,
          style: { stroke: phaseColor, strokeWidth: 2, opacity: 0.6 },
          markerEnd: { type: MarkerType.ArrowClosed, color: phaseColor },
        });
      }
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges, 'TB');
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [roadmap, tasks, blockers, expandedPhases, setNodes, setEdges, toggleExpand]);

  const onLayout = useCallback((direction) => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, direction);
    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
  }, [nodes, edges, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, node) => onNodeClick && onNodeClick({ type: 'milestone', data: node.data.milestone, index: node.data.index })}
      nodeTypes={nodeTypes}
      fitView
      attributionPosition="bottom-right"
    >
      <Background color="#ffffff" gap={24} size={1} opacity={0.03} />
      
      <Panel position="top-right" style={{ display: 'flex', gap: '8px', zIndex: 10 }}>
        {/* Export Dropdown in parent handles download, we just provide the button here if needed, but we put it in the wrapper */}
      </Panel>
    </ReactFlow>
  );
};

export default function RoadmapFlowchart({ roadmap = [], tasks = [], blockers = [], onNodeClick }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const flowWrapperRef = useRef(null);

  const generateMermaidMarkdown = () => {
    if (!roadmap || roadmap.length === 0) return '';
    let md = '```mermaid\ngraph TD;\n';
    
    roadmap.forEach((milestone, mIdx) => {
      const nodeId = `M${mIdx}`;
      const title = milestone.title.replace(/["']/g, ''); // sanitize
      md += `  ${nodeId}["<b>${milestone.phase}</b><br/>${title}"]\n`;
      
      if (mIdx > 0) {
        md += `  M${mIdx - 1} --> ${nodeId}\n`;
      }
    });
    
    md += '```';
    return md;
  };

  const handleDownload = (format) => {
    setShowDropdown(false);
    if (format === 'md') {
      const markdown = generateMermaidMarkdown();
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `roadmap_${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (!flowWrapperRef.current) return;

    // React Flow specific targeting for image export
    const flowElement = flowWrapperRef.current.querySelector('.react-flow');
    if (!flowElement) return;

    const options = {
      backgroundColor: '#0a0b10',
      quality: 0.95
    };

    let downloadFn = format === 'png' ? toPng : format === 'jpg' ? toJpeg : toSvg;

    downloadFn(flowElement, options)
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `roadmap_${Date.now()}.${format}`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('Export failed:', err);
        alert('Failed to generate image file.');
      });
  };

  const renderContent = () => {
    return (
      <div 
        ref={flowWrapperRef}
        className={`roadmap-sh-container ${isFullscreen ? 'fullscreen' : 'pane-mode'}`}
        style={{
          position: isFullscreen ? 'fixed' : 'relative',
          top: isFullscreen ? 0 : 'auto',
          left: isFullscreen ? 0 : 'auto',
          width: '100%',
          height: isFullscreen ? '100vh' : '100%',
          backgroundColor: '#0a0b10',
          color: '#ffffff',
          fontFamily: '"Geist Sans", system-ui, sans-serif',
          border: isFullscreen ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: isFullscreen ? '0' : '12px',
          boxShadow: isFullscreen ? 'none' : '0 12px 40px rgba(0, 0, 0, 0.4)',
          transition: 'all 0.25s ease',
          zIndex: isFullscreen ? 9999999 : 1,
          overflow: 'hidden'
        }}
      >
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          display: 'flex',
          gap: '8px',
          zIndex: 10
        }}>
          {/* Download Dropdown */}
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowDropdown(!showDropdown)} 
              className="ctrl-btn-action"
            >
              <Download size={13} /> Export <ChevronDown size={12} />
            </button>
            {showDropdown && (
              <div className="export-dropdown">
                <button className="dropdown-item" onClick={() => handleDownload('md')}>Mermaid.md</button>
                <button className="dropdown-item" onClick={() => handleDownload('png')}>PNG Image</button>
                <button className="dropdown-item" onClick={() => handleDownload('jpg')}>JPG Image</button>
                <button className="dropdown-item" onClick={() => handleDownload('svg')}>SVG Vector</button>
              </div>
            )}
          </div>

          <button onClick={() => setIsFullscreen(!isFullscreen)} className="ctrl-btn-action">
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>

        <ReactFlowProvider>
          <Flow 
            roadmap={roadmap} 
            tasks={tasks} 
            blockers={blockers} 
            onNodeClick={onNodeClick}
          />
        </ReactFlowProvider>

        <style>{`
          .ctrl-btn-action {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 6px;
            padding: 6px 12px;
            cursor: pointer;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 800;
            font-size: 11px;
            color: #fff;
            transition: all 0.15s ease;
            backdrop-filter: blur(10px);
          }
          .ctrl-btn-action:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.15);
          }
          .export-dropdown {
            position: absolute;
            top: 36px;
            right: 0;
            background: rgba(15, 17, 26, 0.95);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 6px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            width: 140px;
            z-index: 10000001;
          }
          .dropdown-item {
            background: transparent;
            border: none;
            padding: 10px 12px;
            text-align: left;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            width: 100%;
            color: #d1d5db;
            transition: background-color 0.15s ease, color 0.15s ease;
          }
          .dropdown-item:hover {
            background-color: rgba(255, 255, 255, 0.05);
            color: #fff;
          }
          .dropdown-item:not(:last-child) {
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          }
          .react-flow__node {
            background: transparent;
            border: none;
            border-radius: 0;
            padding: 0;
          }
          .react-flow__edge-path {
            stroke-width: 3;
          }
        `}</style>
      </div>
    );
  };

  if (isFullscreen) {
    return createPortal(renderContent(), document.body);
  }
  return renderContent();
}
