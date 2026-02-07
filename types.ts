
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Point {
  x: number;
  y: number;
}

export interface Platform {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  isLava?: boolean;
  isGoal?: boolean;
  speed?: number;
  range?: number;
  initialX?: number;
}

export interface ObbyCharacter {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  onGround: boolean;
  isDead: boolean;
}

// Added Bubble types for GeminiSlingshot
export type BubbleColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

export interface Bubble {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  color: BubbleColor;
  active: boolean;
}

// Added Orb and Pocket types for GeminiCosmicBilliards
export type OrbColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange';

export interface Orb {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: OrbColor;
  active: boolean;
  isStriker?: boolean;
}

export interface Pocket {
  id: string;
  x: number;
  y: number;
  radius: number;
}

// Added NoobCharacter for RobloxNoobLauncher
export interface NoobCharacter {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  active: boolean;
  type: 'striker' | 'noob';
  color: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface StrategicHint {
  message: string;
  rationale?: string;
  targetPlatformId?: string;
  suggestedPower?: number;
  suggestedAngle?: number;
  // Extended fields for other game modes
  targetRow?: number;
  targetCol?: number;
  recommendedColor?: any;
}

export interface DebugInfo {
  latency: number;
  screenshotBase64?: string;
  promptContext: string;
  rawResponse: string;
  parsedResponse?: any;
  error?: string;
  timestamp: string;
}

export interface AiResponse {
  hint: StrategicHint;
  debug: DebugInfo;
}

declare global {
  interface Window {
    Hands: any;
    Pose: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    HAND_CONNECTIONS: any;
    POSE_CONNECTIONS: any;
  }
}
