
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';

const RobloxGeminiObby: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const handsRef = useRef<any>(null);
  const poseRef = useRef<any>(null);
  const cameraRefInstance = useRef<any>(null);
  
  const latestLandmarks = useRef<any[]>([]);
  const latestPoseLandmarks = useRef<any>(null);
  const isTrackingActive = useRef<boolean>(false);
  const isPoseActive = useRef<boolean>(false);
  const isSystemClosing = useRef<boolean>(false);
  
  const frameId = useRef<number>(0);
  const lastTrackingTime = useRef<number>(0);
  const lastPoseTrackingTime = useRef<number>(0);
  const scanLinePos = useRef<number>(0);

  const stoneRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    isHeld: false,
    width: 65,
    height: 65,
    spawnX: 0,
    spawnY: 0
  });

  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);

  const startGame = async () => {
    setLoading(true);
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      setStarted(true);
    } catch (err: any) {
      alert("Kamera izni gerekli.");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!started || !videoRef.current || !canvasRef.current || !containerRef.current) return;
    
    isSystemClosing.current = false;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      const boxSize = 250;
      const boxX = 40;
      const boxY = (canvas.height / 2) - (boxSize / 2);
      stoneRef.current.spawnX = boxX + boxSize / 2;
      stoneRef.current.spawnY = boxY + boxSize / 2;
      
      if (!stoneRef.current.isHeld) {
        stoneRef.current.x = stoneRef.current.spawnX;
        stoneRef.current.y = stoneRef.current.spawnY;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    const gameLoop = () => {
      if (!ctx || isSystemClosing.current) return;
      
      const width = canvas.width;
      const height = canvas.height;

      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-width, 0);

      ctx.fillStyle = '#00A2FF';
      ctx.fillRect(0, 0, width, height);
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      const studSize = 40;
      for (let x = 0; x < width; x += studSize) {
        for (let y = 0; y < height; y += studSize) {
          ctx.beginPath();
          ctx.arc(x + studSize/2, y + studSize/2, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const boxSize = 250;
      const boxX = width - 290; 
      const boxY = (height / 2) - (boxSize / 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(boxX, boxY, boxSize, boxSize);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(boxX, boxY, boxSize, boxSize);

      scanLinePos.current = (scanLinePos.current + 3) % boxSize;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.moveTo(boxX, boxY + scanLinePos.current);
      ctx.lineTo(boxX + boxSize, boxY + scanLinePos.current);
      ctx.stroke();

      const stone = stoneRef.current;
      if (stone.spawnX === 0) {
        stone.spawnX = boxX + boxSize/2;
        stone.spawnY = boxY + boxSize/2;
        stone.x = stone.spawnX;
        stone.y = stone.spawnY;
      }

      const hands = latestLandmarks.current;
      let isAnyHandPinchingStone = false;

      if (hands && hands.length > 0) {
        hands.forEach((landmarkList: any) => {
          const thumbTip = landmarkList[4];
          const indexTip = landmarkList[8];
          const hx = indexTip.x * width;
          const hy = indexTip.y * height;
          
          const dist = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));
          const isPinching = dist < 0.06;
          const isOverStone = Math.abs(hx - stone.x) < stone.width / 2 + 40 && Math.abs(hy - stone.y) < stone.height / 2 + 40;

          if (isPinching && isOver