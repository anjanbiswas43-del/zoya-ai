/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mic, MicOff, Power, Volume2, VolumeX, Sparkles, Activity } from "lucide-react";
import { AudioStreamer } from "./lib/audio-streamer";
import { LiveSession } from "./lib/live-session";

type State = "disconnected" | "connecting" | "idle" | "listening" | "speaking";

export default function App() {
  const [state, setState] = useState<State>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const liveSessionRef = useRef<LiveSession | null>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  const handleAudioData = useCallback((base64Data: string) => {
    if (liveSessionRef.current && state !== "disconnected" && state !== "connecting") {
      liveSessionRef.current.sendAudio(base64Data);
      // We don't set state to "listening" here because it's continuous
    }
  }, [state]);

  const stopSession = useCallback(() => {
    liveSessionRef.current?.disconnect();
    audioStreamerRef.current?.stop();
    setState("disconnected");
  }, []);

  const startSession = useCallback(async () => {
    setError(null);
    setState("connecting");

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      setError("Gemini API Key is missing. Please add it to your secrets.");
      setState("disconnected");
      return;
    }

    try {
      audioStreamerRef.current = new AudioStreamer(handleAudioData);
      
      liveSessionRef.current = new LiveSession(apiKey, {
        onOpen: () => {
          setState("idle");
          audioStreamerRef.current?.start().catch(err => {
            console.error("Mic start error:", err);
            setError("Could not access microphone.");
            stopSession();
          });
        },
        onClose: () => {
          stopSession();
        },
        onAudio: (base64Data) => {
          setState("speaking");
          audioStreamerRef.current?.playAudioChunk(base64Data);
          // We'll reset to idle after a short delay or when audio stops
          // But for now, let's just keep it simple
        },
        onInterrupted: () => {
          // Handle interruption if needed
          setState("idle");
        },
        onError: (err) => {
          console.error("Session error:", err);
          setError("Something went wrong with Zoya. Try again?");
          stopSession();
        },
        onTranscription: (text, isModel) => {
          if (isModel) {
            // Model finished speaking a part
            setTimeout(() => setState("idle"), 1000);
          }
        }
      });

      await liveSessionRef.current.connect();
    } catch (err) {
      console.error("Start error:", err);
      setError("Failed to wake up Zoya.");
      setState("disconnected");
    }
  }, [handleAudioData, stopSession]);

  const togglePower = () => {
    if (state === "disconnected") {
      startSession();
    } else {
      stopSession();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 font-sans overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-900/10 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-12 flex flex-col items-center gap-2"
      >
        <h1 className="text-4xl font-bold tracking-tighter bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
          ZOYA
        </h1>
        <div className="flex items-center gap-2 text-xs font-mono text-gray-500 uppercase tracking-[0.2em]">
          <Sparkles size={12} className="text-purple-500" />
          <span>Sassy AI Assistant</span>
        </div>
      </motion.div>

      {/* Main Interaction Area */}
      <div className="relative flex flex-col items-center justify-center gap-12 z-10">
        {/* The Orb */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {state === "speaking" && (
              <motion.div
                key="speaking-ring"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-purple-500/30 rounded-full blur-2xl"
              />
            )}
            {state === "listening" && (
              <motion.div
                key="listening-ring"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl"
              />
            )}
          </AnimatePresence>

          <motion.div
            animate={{
              scale: state === "speaking" ? [1, 1.05, 1] : 1,
              borderColor: state === "disconnected" ? "#333" : state === "connecting" ? "#6366f1" : "#a855f7"
            }}
            transition={{ duration: 0.5, repeat: state === "speaking" ? Infinity : 0 }}
            className={`w-48 h-48 rounded-full border-2 flex items-center justify-center relative bg-black/40 backdrop-blur-sm shadow-[0_0_50px_rgba(168,85,247,0.1)]`}
          >
            {/* Waveform Visualization (Mock) */}
            <div className="flex items-end gap-1 h-12">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    height: state === "speaking" || state === "listening" 
                      ? [10, Math.random() * 40 + 10, 10] 
                      : 4
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    delay: i * 0.05
                  }}
                  className={`w-1.5 rounded-full ${
                    state === "speaking" ? "bg-purple-500" : 
                    state === "listening" ? "bg-blue-500" : "bg-gray-700"
                  }`}
                />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Status Text */}
        <div className="h-8 flex flex-col items-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={state}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-sm font-medium text-gray-400"
            >
              {state === "disconnected" && "Zoya is sleeping..."}
              {state === "connecting" && "Waking up Zoya..."}
              {state === "idle" && "I'm listening, babe."}
              {state === "listening" && "Go on, I'm all ears."}
              {state === "speaking" && "Zoya is talking..."}
            </motion.p>
          </AnimatePresence>
          {error && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-red-400 mt-2"
            >
              {error}
            </motion.p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-8">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-4 rounded-full bg-gray-900/50 border border-gray-800 hover:bg-gray-800 transition-colors text-gray-400"
          >
            {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
          </button>

          <button
            onClick={togglePower}
            disabled={state === "connecting"}
            className={`p-8 rounded-full transition-all duration-500 shadow-lg ${
              state === "disconnected" 
                ? "bg-gray-900 border border-gray-800 text-gray-500 hover:text-white" 
                : "bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-purple-500/20"
            }`}
          >
            <Power size={32} className={state === "connecting" ? "animate-pulse" : ""} />
          </button>

          <div className="p-4 rounded-full bg-gray-900/50 border border-gray-800 text-gray-400 opacity-50">
            <Activity size={24} />
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-12 text-[10px] font-mono text-gray-600 uppercase tracking-widest flex items-center gap-4"
      >
        <span>Real-time Audio Engine</span>
        <span className="w-1 h-1 bg-gray-800 rounded-full" />
        <span>Gemini 3.1 Live</span>
        <span className="w-1 h-1 bg-gray-800 rounded-full" />
        <span>Encrypted Session</span>
      </motion.div>
    </div>
  );
}
