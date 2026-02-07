
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, Type } from "@google/genai";
import { AiResponse, DebugInfo, Platform, ObbyCharacter } from "../types";

const MODEL_NAME = "gemini-3-flash-preview";

// Exported for Slingshot tactical analysis
export interface TargetCandidate {
  id: string;
  color: string;
  size: number;
  row: number;
  col: number;
  pointsPerBubble: number;
  description: string;
}

/**
 * Provides tactical hints for the Roblox Obby game mode.
 */
export const getObbyHint = async (
  imageBase64: string,
  platforms: Platform[],
  player: ObbyCharacter
): Promise<AiResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const startTime = performance.now();
  
  const debug: DebugInfo = {
    latency: 0,
    screenshotBase64: imageBase64,
    promptContext: "",
    rawResponse: "",
    timestamp: new Date().toLocaleTimeString()
  };

  const platformData = platforms.map(p => 
    `Platform ${p.id} at {x: ${Math.round(p.x)}, y: ${Math.round(p.y)}, w: ${p.width}}${p.isLava ? ' [LAVA]' : ''}${p.isGoal ? ' [GOAL]' : ''}`
  ).join("\n");

  const prompt = `
    Sen bir Roblox Obby Ustasısın. Oyuncu karakterini fırlatarak hedefe ulaşmaya çalışıyor.
    
    OYUNCU DURUMU:
    Pozisyon: {x: ${Math.round(player.x)}, y: ${Math.round(player.y)}}
    PARKUR VERİLERİ:
    ${platformData}

    GÖREV:
    1. Ekran görüntüsünü ve platform koordinatlarını analiz et.
    2. Bir sonraki en güvenli platformu belirle.
    3. JSON formatında kısa, öz ve eğlenceli bir tavsiye ver.

    JSON Formatı:
    {
      "message": "Oyuncu için kısa talimat",
      "rationale": "Mantık",
      "targetPlatformId": "hedef platform id",
      "suggestedPower": 0.1 - 1.0,
      "suggestedAngle": -180 - 180
    }
  `;

  debug.promptContext = prompt;

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            rationale: { type: Type.STRING },
            targetPlatformId: { type: Type.STRING },
            suggestedPower: { type: Type.NUMBER },
            suggestedAngle: { type: Type.NUMBER }
          },
          required: ["message", "rationale", "targetPlatformId", "suggestedPower", "suggestedAngle"]
        }
      },
      contents: {
        parts: [{ text: prompt }, { inlineData: { mimeType: "image/png", data: cleanBase64 } }]
      }
    });

    const endTime = performance.now();
    debug.latency = Math.round(endTime - startTime);
    debug.rawResponse = response.text || "{}";

    const json = JSON.parse(debug.rawResponse);
    debug.parsedResponse = json;
    return {
        hint: json,
        debug
    };
  } catch (error: any) {
    return {
        hint: { message: "Bağlantı koptu!" },
        debug: { ...debug, error: error.message }
    };
  }
};

/**
 * Generic tactical analyzer for various game modes (Slingshot, Billiards, Launcher).
 * Handles polymorphic arguments to construct specialized prompts for Gemini.
 */
export const getStrategicHint = async (
  imageBase64: string,
  ...args: any[]
): Promise<AiResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const startTime = performance.now();
  
  const debug: DebugInfo = {
    latency: 0,
    screenshotBase64: imageBase64,
    promptContext: "",
    rawResponse: "",
    timestamp: new Date().toLocaleTimeString()
  };

  let gameModeContext = "Analyze the current game screen and provide the best move.";
  
  // Detection logic for Slingshot call: (screenshot, allClusters, maxRow)
  if (args.length === 2 && Array.isArray(args[0]) && typeof args[1] === 'number') {
    gameModeContext = `SLINGSHOT GAME STATE:
    Task: Aim the slingshot to pop bubble clusters.
    Clusters: ${JSON.stringify(args[0])}
    Current Max Bubble Row: ${args[1]}`;
  } 
  // Detection logic for Billiards call: (screenshot, orbs, pockets, striker)
  else if (args.length === 3 && Array.isArray(args[0]) && Array.isArray(args[1])) {
    gameModeContext = `COSMIC BILLIARDS STATE:
    Task: Suggest a shot to knock orbs into pockets.
    Active Orbs: ${JSON.stringify(args[0].filter((o: any) => o.active))}
    Pockets: ${JSON.stringify(args[1])}
    Striker: ${JSON.stringify(args[2])}`;
  }
  // Detection logic for Noob Launcher call: (screenshot, entities, striker)
  else if (args.length === 2 && Array.isArray(args[0])) {
    gameModeContext = `ROBLOX NOOB LAUNCHER STATE:
    Task: Knock the Noobs off the platform using the striker.
    Entities: ${JSON.stringify(args[0].filter((e: any) => e.active))}
    Striker: ${JSON.stringify(args[1])}`;
  }

  const prompt = `
    ${gameModeContext}
    Analyze the visual field and data. 
    Provide tactical advice in JSON format.

    Required JSON Output:
    {
      "message": "Direct instructional hint",
      "rationale": "Strategic reasoning",
      "targetRow": number (optional),
      "targetCol": number (optional),
      "recommendedColor": "red|blue|green|yellow|purple|orange" (optional)
    }
  `;

  debug.promptContext = prompt;

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            rationale: { type: Type.STRING },
            targetRow: { type: Type.NUMBER },
            targetCol: { type: Type.NUMBER },
            recommendedColor: { type: Type.STRING }
          },
          required: ["message", "rationale"]
        }
      },
      contents: {
        parts: [{ text: prompt }, { inlineData: { mimeType: "image/png", data: cleanBase64 } }]
      }
    });

    const endTime = performance.now();
    debug.latency = Math.round(endTime - startTime);
    debug.rawResponse = response.text || "{}";

    const json = JSON.parse(debug.rawResponse);
    debug.parsedResponse = json;
    return {
        hint: json,
        debug
    };
  } catch (error: any) {
    return {
        hint: { message: "Tactical sync failure." },
        debug: { ...debug, error: error.message }
    };
  }
};
