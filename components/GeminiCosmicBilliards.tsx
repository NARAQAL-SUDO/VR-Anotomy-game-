
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getStrategicHint } from '../services/geminiService';
import { Point, Orb, OrbColor, Particle, DebugInfo, Pocket } from '../types';
import { Loader2, Trophy, BrainCircuit, Play, MousePointerClick, Eye, Terminal, AlertTriangle, Target, Lightbulb, Monitor, Zap } from 'lucide-react';

const PINCH_THRESHOLD = 0.05;
const FRICTION = 0.985;
const WALL_BOUNCE = 0.7;
const MIN_VELOCITY = 0.1;

const ORB_RADIUS = 20;
const STRIKER_RADIUS = 24;
const POCKET_RADIUS = 45;

const COLOR_CONFIG: Record<OrbColor, { hex: string, points: number, label: string }> = {
  red:    { hex: '#ef5350', points: 100, label: 'Red' },
  blue:   { hex: '#42a5f5', points: 150, label: 'Blue' },
  green:  { hex: '#66bb6a', points: 200, label: 'Green' },
  yellow: { hex: '#ffee58', points: 250, label: 'Yellow' },
  purple: { hex: '#ab47bc', points: 300, label: 'Purple' },
  orange: { hex: '#ffa726', points: 500, label: 'Orange' }
};

const COLOR_KEYS: OrbColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

const GeminiCosmicBilliards: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const orbs = useRef<Orb[]>([]);
  const pockets = useRef<Pocket[]>([]);
  const particles = useRef<Particle[]>([]);
  const scoreRef = useRef<number>(0);
  const isPinching = useRef<boolean>(false);
  const isAiThinking = useRef<boolean>(false);
  const captureRequested = useRef<boolean>(false);

  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [aiHint, setAiHint] = useState<string | null>("Initializing tactical engine...");
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [thinking, setThinking] = useState(false);

  const initGame = useCallback((w: number, h: number) => {
    // Setup Pockets (4 Corners)
    pockets.current = [
        { id: 'tl', x: POCKET_RADIUS, y: POCKET_RADIUS, radius: POCKET_RADIUS },
        { id: 'tr', x: w - POCKET_RADIUS, y: POCKET_RADIUS, radius: POCKET_RADIUS },
        { id: 'bl', x: POCKET_RADIUS, y: h - POCKET_RADIUS, radius: POCKET_RADIUS },
        { id: 'br', x: w - POCKET_RADIUS, y: h - POCKET_RADIUS, radius: POCKET_RADIUS }
    ];

    // Setup Orbs
    const newOrbs: Orb[] = [];
    // Striker (Player's orb)
    newOrbs.push({
        id: 'striker',
        x: w / 2,
        y: h - 150,
        vx: 0,
        vy: 0,
        radius: STRIKER_RADIUS,
        color: 'blue',
        active: true,
        isStriker: true
    });

    // Target Orbs in a triangle formation
    const centerX = w / 2;
    const centerY = h / 3;
    let idCounter = 0;
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col <= row; col++) {
            newOrbs.push({
                id: `orb-${idCounter++}`,
                x: centerX + (col - row / 2) * (ORB_RADIUS * 2.2),
                y: centerY + row * (ORB_RADIUS * 2),
                vx: 0,
                vy: 0,
                radius: ORB_RADIUS,
                color: COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)],
                active: true
            });
        }
    }
    orbs.current = newOrbs;
    captureRequested.current = true;
  }, []);

  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 20; i++) {
      // Added size property to satisfy Particle interface
      particles.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15,
        life: 1.0,
        color,
        size: Math.random() * 4 + 2
      });
    }
  };

  const handleCollisions = (w: number, h: number) => {
    const allOrbs = orbs.current.filter(o => o.active);
    
    // Orb-Orb Collision
    for (let i = 0; i < allOrbs.length; i++) {
        for (let j = i + 1; j < allOrbs.length; j++) {
            const o1 = allOrbs[i];
            const o2 = allOrbs[j];
            const dx = o2.x - o1.x;
            const dy = o2.y - o1.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const minDist = o1.radius + o2.radius;

            if (dist < minDist && dist > 0) {
                // Resolve overlap
                const angle = Math.atan2(dy, dx);
                const overlap = minDist - dist;
                const ax = Math.cos(angle) * (overlap * 0.5);
                const ay = Math.sin(angle) * (overlap * 0.5);
                o1.x -= ax; o1.y -= ay;
                o2.x += ax; o2.y += ay;

                // Basic elastic collision
                const nx = dx / dist;
                const ny = dy / dist;
                const p = (o1.vx * nx + o1.vy * ny - o2.vx * nx - o2.vy * ny);
                
                o1.vx -= p * nx;
                o1.vy -= p * ny;
                o2.vx += p * nx;
                o2.vy += p * ny;
            }
        }
    }

    // Wall Bounce & Friction & Pocket Check
    allOrbs.forEach(o => {
        o.x += o.vx;
        o.y += o.vy;
        
        o.vx *= FRICTION;
        o.vy *= FRICTION;

        if (Math.abs(o.vx) < MIN_VELOCITY) o.vx = 0;
        if (Math.abs(o.vy) < MIN_VELOCITY) o.vy = 0;

        // Boundaries
        if (o.x < o.radius) { o.x = o.radius; o.vx *= -WALL_BOUNCE; }
        if (o.x > w - o.radius) { o.x = w - o.radius; o.vx *= -WALL_BOUNCE; }
        if (o.y < o.radius) { o.y = o.radius; o.vy *= -WALL_BOUNCE; }
        if (o.y > h - o.radius) { o.y = h - o.radius; o.vy *= -WALL_BOUNCE; }

        // Pocket check
        pockets.current.forEach(p => {
            const dx = o.x - p.x;
            const dy = o.y - p.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < p.radius) {
                if (o.isStriker) {
                    // Striker reset
                    o.vx = 0; o.vy = 0;
                    o.x = w / 2; o.y = h - 150;
                } else {
                    o.active = false;
                    createExplosion(o.x, o.y, COLOR_CONFIG[o.color].hex);
                    scoreRef.current += COLOR_CONFIG[o.color].points;
                    setScore(scoreRef.current);
                    captureRequested.current = true;
                }
            }
        });
    });
  };

  const drawOrb = (ctx: CanvasRenderingContext2D, orb: Orb) => {
    const { x, y, radius, color, isStriker } = orb;
    const hex = isStriker ? '#ffffff' : COLOR_CONFIG[color].hex;
    
    ctx.save();
    const grad = ctx.createRadialGradient(x - radius*0.3, y - radius*0.3, radius*0.1, x, y, radius);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.3, hex);
    grad.addColorStop(1, '#000');
    
    ctx.shadowBlur = isStriker ? 25 : 15;
    ctx.shadowColor = hex;
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI*2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  };

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    initGame(canvas.width, canvas.height);

    let camera: any = null;
    let hands: any = null;

    const onResults = (results: any) => {
      setLoading(false);
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      
      // Cosmic Overlay
      ctx.fillStyle = 'rgba(10, 10, 20, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Pockets Rendering
      pockets.current.forEach(p => {
          const grad = ctx.createRadialGradient(p.x, p.y, 5, p.x, p.y, p.radius);
          grad.addColorStop(0, '#000');
          grad.addColorStop(0.7, '#1a0b2e');
          grad.addColorStop(1, 'rgba(171, 71, 188, 0.2)');
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.strokeStyle = '#ab47bc';
          ctx.lineWidth = 2;
          ctx.stroke();
      });

      const striker = orbs.current.find(o => o.isStriker);
      if (!striker) return;

      let handPos: Point | null = null;
      let isPinch = false;

      if (results.multiHandLandmarks?.[0]) {
        const landmarks = results.multiHandLandmarks[0];
        const thumb = landmarks[4];
        const index = landmarks[8];
        
        handPos = {
          x: (thumb.x + index.x) / 2 * canvas.width,
          y: (thumb.y + index.y) / 2 * canvas.height
        };
        
        const dist = Math.sqrt(Math.pow(thumb.x - index.x, 2) + Math.pow(thumb.y - index.y, 2));
        isPinch = dist < PINCH_THRESHOLD;

        // Visual Tracking
        if (window.drawConnectors) {
            window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {color: '#42a5f5', lineWidth: 1});
        }
        if (window.drawLandmarks) {
            // EKLEM YERLERINI BEYAZ NOKTA YAPMA
            window.drawLandmarks(ctx, landmarks, {color: '#ffffff', lineWidth: 1, radius: 3});
        }
      }

      // Physics & Interactions
      const moving = orbs.current.some(o => o.active && (Math.abs(o.vx) > 0.1 || Math.abs(o.vy) > 0.1));
      
      if (!moving) {
          if (handPos && isPinch) {
              const distToStriker = Math.sqrt(Math.pow(handPos.x - striker.x, 2) + Math.pow(handPos.y - striker.y, 2));
              if (distToStriker < 80) isPinching.current = true;
          }

          if (isPinching.current && handPos) {
              const dx = striker.x - handPos.x;
              const dy = striker.y - handPos.y;
              const dragDist = Math.min(Math.sqrt(dx*dx + dy*dy), 150);
              const angle = Math.atan2(dy, dx);
              
              // Aiming Path
              ctx.setLineDash([8, 8]);
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(striker.x, striker.y);
              ctx.lineTo(striker.x + Math.cos(angle) * dragDist * 4, striker.y + Math.sin(angle) * dragDist * 4);
              ctx.stroke();
              ctx.setLineDash([]);

              if (!isPinch) {
                  isPinching.current = false;
                  striker.vx = Math.cos(angle) * dragDist * 0.18;
                  striker.vy = Math.sin(angle) * dragDist * 0.18;
              }
          }
      }

      handleCollisions(canvas.width, canvas.height);
      orbs.current.filter(o => o.active).forEach(o => drawOrb(ctx, o));

      // Particle Effects
      for (let i = particles.current.length - 1; i >= 0; i--) {
          const p = particles.current[i];
          p.x += p.vx; p.y += p.vy; p.life -= 0.025;
          if (p.life <= 0) particles.current.splice(i, 1);
          else {
              ctx.globalAlpha = p.life;
              ctx.fillStyle = p.color;
              ctx.beginPath(); 
              // Use p.size for consistent radius
              ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); 
              ctx.fill();
              ctx.globalAlpha = 1;
          }
      }

      // AI Analysis Trigger
      if (captureRequested.current && !moving && !isAiThinking.current) {
          captureRequested.current = false;
          isAiThinking.current = true;
          setThinking(true);
          const screenshot = canvas.toDataURL("image/jpeg", 0.6);
          getStrategicHint(screenshot, orbs.current, pockets.current, striker).then(res => {
              setAiHint(res.hint.message);
              setAiRationale(res.hint.rationale || null);
              setDebugInfo(res.debug);
              setThinking(false);
              isAiThinking.current = false;
          }).catch(() => {
              setThinking(false);
              isAiThinking.current = false;
          });
      }
      ctx.restore();
    };

    if (window.Hands) {
      hands = new window.Hands({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5 });
      hands.onResults(onResults);
      camera = new window.Camera(video, { 
        onFrame: async () => {
          if (videoRef.current) await hands.send({ image: videoRef.current });
        }, 
        width: 1280, 
        height: 720 
      });
      camera.start();
    }
    return () => { camera?.stop(); hands?.close(); };
  }, [initGame]);

  return (
    <div className="flex w-full h-screen bg-[#05050a] overflow-hidden font-sans text-[#e3e3e3]">
      <div ref={containerRef} className="flex-1 relative h-full">
        <video ref={videoRef} className="hidden" playsInline />
        <canvas ref={canvasRef} className="absolute inset-0" />
        {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#05050a] z-50">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-12 h-12 text-[#42a5f5] animate-spin" />
                  <p className="text-cyan-400 font-bold tracking-widest animate-pulse">BOOTING NEURAL LINKS...</p>
                </div>
            </div>
        )}
        <div className="absolute top-6 left-6 z-40 bg-[#1e1e2e]/80 p-5 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <p className="text-3xl font-mono font-bold">{score}</p>
            </div>
        </div>
      </div>

      <div className="w-[400px] bg-[#0c0c14] border-l border-white/10 flex flex-col h-full shadow-2xl overflow-y-auto">
        <div className="p-6 border-b border-white/5 bg-[#151525]">
            <div className="flex items-center gap-3 mb-4">
                <BrainCircuit className="w-6 h-6 text-cyan-400" />
                <h2 className="text-lg font-bold uppercase tracking-widest text-cyan-400">Tactical Navigator</h2>
            </div>
            <div className="bg-black/40 p-4 rounded-xl border border-cyan-500/30 min-h-[100px] flex flex-col justify-center">
                {thinking ? (
                  <div className="flex items-center gap-2 text-cyan-400 animate-pulse text-sm">
                    <Zap className="w-4 h-4" /> Analyzing geometry...
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium leading-relaxed">{aiHint}</p>
                    {aiRationale && <p className="text-xs text-cyan-400/70 mt-2 italic">“{aiRationale}”</p>}
                  </>
                )}
            </div>
        </div>

        <div className="p-4 space-y-6">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-tighter">
                <Terminal className="w-3 h-3" /> Visual Memory
            </div>
            
            {debugInfo?.screenshotBase64 && (
                <div className="rounded-lg overflow-hidden border border-white/10 bg-black/50 shadow-inner">
                    <img src={debugInfo.screenshotBase64} alt="AI View" className="w-full opacity-70 hover:opacity-100 transition-opacity" />
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase mb-1 font-bold">Neural Latency</p>
                    <p className="text-lg font-mono text-cyan-400">{debugInfo?.latency || 0}ms</p>
                </div>
                <div className="bg-white/5 p-3 rounded-lg border border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase mb-1 font-bold">Active Targets</p>
                    <p className="text-lg font-mono text-purple-400">{orbs.current.filter(o => o.active && !o.isStriker).length}</p>
                </div>
            </div>

            {debugInfo?.rawResponse && (
                <div className="space-y-2">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Raw Inference Data</p>
                    <pre className="bg-black/60 p-3 rounded border border-white/5 text-[10px] text-green-400 font-mono overflow-x-auto max-h-48 whitespace-pre-wrap leading-tight shadow-inner">
                        {debugInfo.rawResponse}
                    </pre>
                </div>
            )}
        </div>
        <div className="mt-auto p-4 border-t border-white/5 text-center">
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">Cosmic Billiards v2.0</p>
        </div>
      </div>
    </div>
  );
};

export default GeminiCosmicBilliards;
