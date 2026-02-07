
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getStrategicHint } from '../services/geminiService';
import { Point, NoobCharacter, Particle, DebugInfo } from '../types';
import { Loader2, BrainCircuit, Play, Terminal, Zap, Trophy, Bomb } from 'lucide-react';

const PINCH_THRESHOLD = 0.04;
const FRICTION = 0.99;
const GRAVITY = 0.25;
const WALL_BOUNCE = 0.6;

const NOOB_WIDTH = 40;
const NOOB_HEIGHT = 60;
const STRIKER_SIZE = 45;

const RobloxNoobLauncher: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const entities = useRef<NoobCharacter[]>([]);
  const particles = useRef<Particle[]>([]);
  const scoreRef = useRef<number>(0);
  const isPinching = useRef<boolean>(false);
  const isAiThinking = useRef<boolean>(false);
  const captureRequested = useRef<boolean>(false);

  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [aiHint, setAiHint] = useState<string | null>("Connecting to Blox Engine...");
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [thinking, setThinking] = useState(false);

  const initGame = useCallback((w: number, h: number) => {
    const newEntities: NoobCharacter[] = [];
    
    // Striker (Roblox Logo Block)
    newEntities.push({
      id: 'striker',
      x: w / 2,
      y: h - 120,
      vx: 0,
      vy: 0,
      width: STRIKER_SIZE,
      height: STRIKER_SIZE,
      active: true,
      type: 'striker',
      color: 'red'
    });

    // Create a tower of Noobs
    const centerX = w / 2;
    const baseY = h - 250;
    
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3 - row; col++) {
        newEntities.push({
          id: `noob-${row}-${col}`,
          x: (centerX - (1 - row / 2) * NOOB_WIDTH) + (col * (NOOB_WIDTH + 10)),
          y: baseY - (row * (NOOB_HEIGHT + 5)),
          vx: 0,
          vy: 0,
          width: NOOB_WIDTH,
          height: NOOB_HEIGHT,
          active: true,
          type: 'noob',
          color: 'yellow'
        });
      }
    }
    
    entities.current = newEntities;
    captureRequested.current = true;
  }, []);

  const createBlockParticle = (x: number, y: number, color: string) => {
    for (let i = 0; i < 12; i++) {
      particles.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10 - 5,
        life: 1.0,
        color,
        size: Math.random() * 8 + 4
      });
    }
  };

  const drawNoob = (ctx: CanvasRenderingContext2D, n: NoobCharacter) => {
    const { x, y, width, height, type } = n;
    
    if (type === 'striker') {
      // Draw Bloxy Logo Style Cube
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(x - width/2, y - height/2, width, height);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(x - width/2, y - height/2, width, height);
      // Logo Inner Square
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - width/6, y - height/6, width/3, height/3);
    } else {
      // Classic Roblox Noob
      const h2 = height / 2;
      const w2 = width / 2;
      
      // Torso (Blue)
      ctx.fillStyle = '#0066ff';
      ctx.fillRect(x - w2, y - h2 + 20, width, height - 30);
      
      // Head (Yellow)
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(x - 15, y - h2, 30, 30);
      
      // Legs (Green)
      ctx.fillStyle = '#00cc00';
      ctx.fillRect(x - w2, y + h2 - 10, width/2 - 2, 20);
      ctx.fillRect(x + 2, y + h2 - 10, width/2 - 2, 20);

      // Simple Face
      ctx.fillStyle = '#000000';
      ctx.fillRect(x - 8, y - h2 + 10, 4, 4); // Eye L
      ctx.fillRect(x + 4, y - h2 + 10, 4, 4); // Eye R
      ctx.fillRect(x - 5, y - h2 + 20, 10, 2); // Mouth
    }
  };

  const updatePhysics = (w: number, h: number) => {
    const activeOnes = entities.current.filter(e => e.active);
    
    activeOnes.forEach((e1, i) => {
      // Apply movement
      e1.x += e1.vx;
      e1.y += e1.vy;
      
      if (e1.type !== 'striker') {
        e1.vy += GRAVITY;
      }
      
      e1.vx *= FRICTION;
      e1.vy *= FRICTION;

      // Collision with Floor
      const floorY = h - 50;
      if (e1.y + e1.height/2 > floorY) {
        e1.y = floorY - e1.height/2;
        e1.vy *= -WALL_BOUNCE;
        if (Math.abs(e1.vy) < 1) e1.vy = 0;
      }

      // Walls
      if (e1.x < 0 || e1.x > w) e1.vx *= -1;

      // Collision with other entities
      for (let j = i + 1; j < activeOnes.length; j++) {
        const e2 = activeOnes[j];
        const dx = e2.x - e1.x;
        const dy = e2.y - e1.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const minDist = 40;

        if (dist < minDist) {
          const angle = Math.atan2(dy, dx);
          const force = 0.5;
          e1.vx -= Math.cos(angle) * force;
          e1.vy -= Math.sin(angle) * force;
          e2.vx += Math.cos(angle) * force;
          e2.vy += Math.sin(angle) * force;

          // Points if striker hits noob
          if ((e1.type === 'striker' || e2.type === 'striker') && (e1.type === 'noob' || e2.type === 'noob')) {
            const noob = e1.type === 'noob' ? e1 : e2;
            if (Math.abs(e1.vx) + Math.abs(e1.vy) > 5) {
                scoreRef.current += 10;
                setScore(scoreRef.current);
                createBlockParticle(noob.x, noob.y, '#ffff00');
            }
          }
        }
      }

      // Falling off screen
      if (e1.y > h + 100) {
        if (e1.type === 'striker') {
          e1.x = w / 2; e1.y = h - 120;
          e1.vx = 0; e1.vy = 0;
        } else {
          e1.active = false;
          scoreRef.current += 100; // Big bonus for knocking off
          setScore(scoreRef.current);
          captureRequested.current = true;
        }
      }
    });
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
      
      // Roblox Background Overlay (Bright Blue Sky)
      ctx.fillStyle = 'rgba(135, 206, 235, 0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Floor (Roblox Stud Plate)
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(0, canvas.height - 50, canvas.width, 50);

      const striker = entities.current.find(e => e.type === 'striker');
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

        // Roblox Style Tracking
        if (window.drawConnectors) {
            window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {color: '#ffffff', lineWidth: 1});
        }
        if (window.drawLandmarks) {
            // EKLEM YERLERINI BEYAZ NOKTA YAPMA (Requested)
            window.drawLandmarks(ctx, landmarks, {color: '#ffffff', fillColor: '#ffffff', lineWidth: 1, radius: 4});
        }
      }

      // Slingshot Logic
      const moving = entities.current.some(e => e.active && (Math.abs(e.vx) > 0.5 || Math.abs(e.vy) > 0.5));
      
      if (!moving) {
          if (handPos && isPinch) {
              const distToStriker = Math.sqrt(Math.pow(handPos.x - striker.x, 2) + Math.pow(handPos.y - striker.y, 2));
              if (distToStriker < 100) isPinching.current = true;
          }

          if (isPinching.current && handPos) {
              const dx = striker.x - handPos.x;
              const dy = striker.y - handPos.y;
              const dragDist = Math.min(Math.sqrt(dx*dx + dy*dy), 180);
              const angle = Math.atan2(dy, dx);
              
              // Aiming Dots (Roblox Style)
              ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
              for(let i=1; i<8; i++) {
                ctx.beginPath();
                ctx.arc(striker.x + Math.cos(angle) * dragDist * (i*0.5), striker.y + Math.sin(angle) * dragDist * (i*0.5), 5 - (i*0.5), 0, Math.PI*2);
                ctx.fill();
              }

              if (!isPinch) {
                  isPinching.current = false;
                  striker.vx = Math.cos(angle) * dragDist * 0.15;
                  striker.vy = Math.sin(angle) * dragDist * 0.15;
              }
          }
      }

      updatePhysics(canvas.width, canvas.height);
      entities.current.filter(e => e.active).forEach(e => drawNoob(ctx, e));

      // Blocky Particles
      for (let i = particles.current.length - 1; i >= 0; i--) {
          const p = particles.current[i];
          p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.02;
          if (p.life <= 0) particles.current.splice(i, 1);
          else {
              ctx.globalAlpha = p.life;
              ctx.fillStyle = p.color;
              ctx.fillRect(p.x, p.y, p.size, p.size);
              ctx.globalAlpha = 1;
          }
      }

      // AI Analysis
      if (captureRequested.current && !moving && !isAiThinking.current) {
          captureRequested.current = false;
          isAiThinking.current = true;
          setThinking(true);
          const screenshot = canvas.toDataURL("image/jpeg", 0.6);
          getStrategicHint(screenshot, entities.current, striker).then(res => {
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
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6 });
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
    <div className="flex w-full h-screen bg-[#00A2FF] overflow-hidden font-sans text-white">
      <div ref={containerRef} className="flex-1 relative h-full">
        <video ref={videoRef} className="hidden" playsInline />
        <canvas ref={canvasRef} className="absolute inset-0" />
        
        {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#00A2FF] z-50">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-16 h-16 text-white animate-spin" />
                  <p className="text-2xl font-black italic tracking-tighter">LOADING ROBLOX...</p>
                </div>
            </div>
        )}

        <div className="absolute top-6 left-6 z-40 bg-[#1e1e2e]/90 p-6 rounded-3xl border-4 border-white shadow-2xl">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <div className="flex flex-col">
                <p className="text-xs font-black uppercase tracking-widest text-gray-400">Total Robux</p>
                <p className="text-4xl font-black italic">{score}</p>
              </div>
            </div>
        </div>
      </div>

      <div className="w-[420px] bg-[#2A2D30] border-l-8 border-[#393B3D] flex flex-col h-full shadow-2xl">
        <div className="p-6 bg-[#393B3D] border-b-4 border-[#1e1e1e]">
            <div className="flex items-center gap-3 mb-4">
                <BrainCircuit className="w-8 h-8 text-[#00A2FF]" />
                <h2 className="text-xl font-black italic uppercase tracking-tighter">Blox Strategy</h2>
            </div>
            <div className="bg-black/30 p-5 rounded-2xl border-2 border-[#00A2FF]/50 min-h-[120px] relative overflow-hidden">
                {thinking ? (
                  <div className="flex items-center gap-3 text-[#00A2FF] animate-pulse">
                    <Zap className="w-5 h-5 fill-current" />
                    <p className="font-black italic uppercase">Computing Vectors...</p>
                  </div>
                ) : (
                  <div className="relative z-10">
                    <p className="text-lg font-bold leading-tight mb-2">{aiHint}</p>
                    {aiRationale && <p className="text-xs text-[#00A2FF] font-bold italic opacity-80">{aiRationale}</p>}
                  </div>
                )}
                <div className="absolute -bottom-4 -right-4 opacity-10">
                    <Bomb className="w-24 h-24" />
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex items-center gap-2 text-xs font-black text-gray-500 uppercase tracking-[0.2em]">
                <Terminal className="w-4 h-4" /> System.Logs
            </div>
            
            {debugInfo?.screenshotBase64 && (
                <div className="rounded-2xl overflow-hidden border-4 border-white/10 bg-black/50 shadow-inner group relative">
                    <img src={debugInfo.screenshotBase64} alt="AI View" className="w-full opacity-60 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-2 right-2 bg-red-600 px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter shadow-lg">Live Feed</div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border-2 border-white/5 hover:border-[#00A2FF]/30 transition-colors">
                    <p className="text-[10px] text-gray-500 uppercase mb-1 font-black">Ping</p>
                    <p className="text-2xl font-black italic text-[#00A2FF]">{debugInfo?.latency || 0}<span className="text-xs ml-1">MS</span></p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border-2 border-white/5 hover:border-[#00A2FF]/30 transition-colors">
                    <p className="text-[10px] text-gray-500 uppercase mb-1 font-black">Noobs Left</p>
                    <p className="text-2xl font-black italic text-yellow-400">{entities.current.filter(e => e.active && e.type === 'noob').length}</p>
                </div>
            </div>

            {debugInfo?.rawResponse && (
                <div className="space-y-2">
                    <p className="text-[10px] text-gray-500 uppercase font-black">Block.Inference</p>
                    <pre className="bg-black/60 p-4 rounded-2xl border-2 border-white/5 text-[10px] text-green-400 font-mono overflow-x-auto max-h-40 whitespace-pre-wrap leading-tight shadow-inner border-l-4 border-l-green-500">
                        {debugInfo.rawResponse}
                    </pre>
                </div>
            )}
        </div>
        
        <div className="p-4 bg-[#1e1e1e] flex items-center justify-between">
            <span className="text-[10px] font-black italic text-gray-600 uppercase tracking-widest">Powered by Gemini Flash</span>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
        </div>
      </div>
    </div>
  );
};

export default RobloxNoobLauncher;
