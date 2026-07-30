import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PopoverFluidBackground, PopoverPaletteSync } from '../engine/FluidEngine';
import { PaletteExtractor } from '../engine/PaletteExtractor';

// ══════════════════════════════════════════════════════════════
//  The Infinite Corridor (Stationary Glass Panels)
// ══════════════════════════════════════════════════════════════
function CorridorWalls({ fluidCanvas }) {
  // Create the dynamic texture from the hidden FluidEngine canvas
  const texture = useMemo(() => {
    if (!fluidCanvas) return null;
    const tex = new THREE.CanvasTexture(fluidCanvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearFilter;
    // Remove repeating entirely so the fluid stretches into one continuous, 
    // unbroken strip down the entire length of the massive panel.
    tex.repeat.set(1, 1);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [fluidCanvas]);

  const { pointer, camera } = useThree();

  // Constantly update the texture to pull the latest WebGL frames from the fluid engine
  useFrame((state, delta) => {
    if (texture) {
      texture.needsUpdate = true;
      // We removed the texture offset animation here.
      // The walls are completely stationary; the fluid naturally boils inside the glass.
    }

    // Smooth camera parallax based on mouse movement
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 4, delta * 2);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, pointer.y * 4, delta * 2);

    // Always look dead center into the infinite vanishing point
    camera.lookAt(0, 0, -150);
  });

  if (!texture) return null;

  return (
    <group>
      {/* Left Wall - Thinned out to a sleek architectural panel */}
      <mesh position={[-20, 0, -100]}>
        {/* Made the wall much thinner (X axis = 2) */}
        <boxGeometry args={[2, 100, 300]} />
        <meshPhysicalMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={10.0}
          color="#ffffff"
          roughness={0.1}
          metalness={0.8}
          clearcoat={1.0}
        />
      </mesh>

      {/* Right Wall - Thinned out to a sleek architectural panel */}
      <mesh position={[20, 0, -100]}>
        <boxGeometry args={[2, 100, 300]} />
        <meshPhysicalMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={10.0}
          color="#ffffff"
          roughness={0.1}
          metalness={0.8}
          clearcoat={1.0}
        />
      </mesh>

    </group>
  );
}

// ══════════════════════════════════════════════════════════════
//  Main Export
// ══════════════════════════════════════════════════════════════
export default function InfiniteArchitecture() {
  const canvasRef = useRef(null);
  const [fluidCanvas, setFluidCanvas] = useState(null);

  useEffect(() => {
    if (canvasRef.current) {
      setFluidCanvas(canvasRef.current);

      const engine = PopoverFluidBackground.make(canvasRef.current);
      if (engine) {
        PopoverPaletteSync.shared.register(engine);
        
        // Exact normalized RGB values extracted via CIAreaAverage from "Am I Dreaming"
        PopoverPaletteSync.shared.push([
          [0.18, 0.09, 0.16, 1.0], // Center (Deep Muted Plum)
          [0.08, 0.06, 0.09, 1.0], // Top Left (Near Black with purple tint)
          [0.24, 0.12, 0.21, 1.0], // Bottom Right (Soft Dark Magenta)
          [0.12, 0.08, 0.14, 1.0], // Top Right (Dark Violet)
          [0.05, 0.04, 0.06, 1.0], // Bottom Left (Abyssal Black)
        ]);
      }

      return () => {
        if (engine) engine.dispose();
      };
    }
  }, []);

  return (
    <>
      {/* Hidden 2D WebGL canvas running the FluidEngine */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          zIndex: -100, opacity: 0.01, pointerEvents: 'none'
        }}
      />

      {/* The 3D World */}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0 }}>
        <Canvas camera={{ position: [0, 0, 0], fov: 50 }} gl={{ antialias: true }}>
          <color attach="background" args={['#050505']} />
          {/* Pitch black fog so the red glowing fluid pops heavily */}
          <fog attach="fog" args={['#050505', 150, 400]} />
          <ambientLight intensity={1.5} />
          <directionalLight position={[0, 20, 50]} intensity={2} color="#ffffff" />
          {fluidCanvas && <CorridorWalls fluidCanvas={fluidCanvas} />}
        </Canvas>
      </div>
    </>
  );
}
