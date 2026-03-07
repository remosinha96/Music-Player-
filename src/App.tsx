/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Upload, Video, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Constants ---
const WAVEFORM_BARS = 100;
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;

const generateStaticWaveform = () => {
  return Array.from({ length: WAVEFORM_BARS }, () => Math.random() * 0.6 + 0.2);
};

export default function App() {
  // --- State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [songTitle, setSongTitle] = useState('KYA KAROON');
  const [artistName, setArtistName] = useState('ZAALIMA RECORDS');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [smoothTime, setSmoothTime] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);

  // --- Refs ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staticWaveform = useMemo(() => generateStaticWaveform(), []);
  
  // Audio Engine Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Smooth Time Tracking
  useEffect(() => {
    let rafId: number;
    const update = () => {
      if (audioRef.current && isPlaying && !isRecording) {
        setSmoothTime(audioRef.current.currentTime);
      }
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, isRecording]);

  // --- Audio Engine Initialization ---
  const initAudioEngine = () => {
    if (audioContextRef.current) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass({
      latencyHint: 'playback',
      sampleRate: 44100,
    });
    
    const source = ctx.createMediaElementSource(audioRef.current!);
    const destination = ctx.createMediaStreamDestination();
    const masterGain = ctx.createGain();
    
    source.connect(masterGain);
    masterGain.connect(destination);
    masterGain.connect(ctx.destination);

    audioContextRef.current = ctx;
    audioDestinationRef.current = destination;
    masterGainRef.current = masterGain;
  };

  // --- Effects ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (!isPlaying) setSmoothTime(audio.currentTime); // Sync on pause/seek
      if (isRecording && audio.duration) {
        setRecordingProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      if (isRecording) stopRecording();
    };
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
    };
  }, [isRecording]);

  useEffect(() => {
    if (isPlaying) {
      initAudioEngine();
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      audioRef.current?.play().catch(() => setIsPlaying(false));
    } else {
      audioRef.current?.pause();
    }
  }, [isPlaying]);

  // --- Handlers ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      if (audioRef.current) {
        audioRef.current.src = url;
        setSongTitle(file.name.replace(/\.[^/.]+$/, "").toUpperCase());
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || duration === 0 || isRecording) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    audioRef.current.currentTime = percent * duration;
  };

  // --- Drawing Logic ---
  const drawFrame = (ctx: CanvasRenderingContext2D, time: number) => {
    // 1. Background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const progress = duration > 0 ? time / duration : 0;

    // 2. Center Icon (Waveform)
    ctx.save();
    ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.35);
    const pulse = isPlaying ? 1 + Math.sin(Date.now() / 300) * 0.015 : 1;
    ctx.scale(pulse * 2.5, pulse * 2.5);
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const path = [[10, 50], [40, 50], [55, 20], [70, 80], [85, 10], [100, 90], [115, 20], [130, 80], [145, 40], [160, 50], [190, 50]];
    ctx.translate(-100, -50);
    ctx.moveTo(path[0][0], path[0][1]);
    path.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.stroke();
    ctx.restore();

    // 3. Song Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px Anton';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '-2px';
    ctx.fillText(songTitle, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.55);

    ctx.fillStyle = '#71717a';
    ctx.font = 'bold 24px Space Grotesk';
    ctx.letterSpacing = '8px';
    ctx.fillText(artistName, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.60);

    // 4. Bottom Waveform
    const footerY = CANVAS_HEIGHT * 0.82;
    const footerH = 100;
    const padding = 120;
    const availableW = CANVAS_WIDTH - (padding * 2);
    const barGap = 2;
    const barW = (availableW - (WAVEFORM_BARS - 1) * barGap) / WAVEFORM_BARS;

    ctx.save();
    ctx.translate(padding, footerY);
    staticWaveform.forEach((h, i) => {
      const barProgress = i / WAVEFORM_BARS;
      // Match UI colors exactly
      ctx.fillStyle = barProgress <= progress ? '#ffffff' : '#18181b';
      const bh = h * footerH;
      ctx.beginPath();
      // Match UI rounding (full rounded)
      ctx.roundRect(i * (barW + barGap), (footerH - bh) / 2, barW, bh, 10);
      ctx.fill();
    });

    // 5. Playhead Line (The white vertical line from UI)
    ctx.fillStyle = '#ffffff';
    const playheadX = progress * availableW;
    ctx.fillRect(playheadX, -10, 3, footerH + 20);
    // Add a subtle glow to the playhead for smoothness
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(playheadX, -10, 3, footerH + 20);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 6. Timestamps
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Space Grotesk';
    ctx.textAlign = 'left';
    ctx.fillText(formatTime(time), padding, footerY + footerH + 80);
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(duration), CANVAS_WIDTH - padding, footerY + footerH + 80);
  };

  // --- Recording Logic ---
  const startRecording = async () => {
    if (!audioRef.current || duration === 0) return;

    initAudioEngine();
    setIsRecording(true);
    setRecordingProgress(0);
    
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    audioRef.current.currentTime = 0;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;

    // 1. Force a "Warm-up" draw to ensure the canvas is active
    drawFrame(ctx, 0);

    // 2. Capture stream (30 FPS is safer for mobile encoders)
    const canvasStream = canvas.captureStream(30); 
    const audioStream = audioDestinationRef.current!.stream;

    const combinedStream = new MediaStream([
      canvasStream.getVideoTracks()[0],
      audioStream.getAudioTracks()[0]
    ]);

    const getMimeType = () => {
      // Priority list for mobile compatibility
      const types = [
        'video/webm;codecs=vp8,opus', // Most stable on Android/Brave
        'video/webm;codecs=h264,opus',
        'video/mp4;codecs=h264,aac',
        'video/webm'
      ];
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) return t;
      }
      return '';
    };

    const mimeType = getMimeType();
    // We use .mp4 extension for the user, but encode with the most stable codec
    const extension = 'mp4'; 

    const recorder = new MediaRecorder(combinedStream, {
      mimeType: mimeType || undefined,
      videoBitsPerSecond: 5000000 // 5Mbps is stable for mobile
    });

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${songTitle.toLowerCase()}.${extension}`;
      link.href = url;
      link.click();
      
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setIsRecording(false);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsPlaying(true);

    // Render loop for recording with smooth interpolation
    let lastAudioTime = 0;
    let lastPerfTime = performance.now();

    const render = () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        const now = performance.now();
        let currentAudioTime = audioRef.current?.currentTime || 0;
        
        // Smooth interpolation between audio clock ticks
        if (currentAudioTime !== lastAudioTime) {
          lastAudioTime = currentAudioTime;
          lastPerfTime = now;
        } else {
          currentAudioTime += (now - lastPerfTime) / 1000;
        }

        drawFrame(ctx, Math.min(currentAudioTime, duration));
        requestAnimationFrame(render);
      }
    };
    render();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsPlaying(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-between font-sans select-none overflow-hidden">
      {/* Hidden Elements */}
      <audio ref={audioRef} crossOrigin="anonymous" />
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/*" className="hidden" />
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="hidden" />

      {/* Recording Overlay */}
      <AnimatePresence>
        {isRecording && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center space-y-8"
          >
            <Loader2 className="w-12 h-12 animate-spin text-white" />
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold uppercase tracking-widest">Exporting Video</h2>
              <p className="text-zinc-500 text-xs uppercase font-mono">Please do not close this tab</p>
            </div>
            <div className="w-64 bg-zinc-900 h-1 rounded-full overflow-hidden">
              <motion.div className="h-full bg-white" initial={{ width: 0 }} animate={{ width: `${recordingProgress}%` }} />
            </div>
            <button onClick={stopRecording} className="px-6 py-2 bg-zinc-800 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center space-x-2">
              <X size={12} /> <span>Cancel</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="w-full px-6 py-8 flex justify-between items-center z-50">
        <button onClick={() => fileInputRef.current?.click()} className="flex items-center space-x-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-bold tracking-widest uppercase">
          <Upload size={14} /> <span>Load MP3</span>
        </button>
        <button onClick={startRecording} disabled={duration === 0 || isRecording} className="flex items-center space-x-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-bold tracking-widest uppercase disabled:opacity-20">
          <Video size={14} /> <span>Export Reel</span>
        </button>
      </div>

      {/* Main Visualizer */}
      <div className="flex-1 w-full flex flex-col items-center justify-between">
        <div className="flex-1 flex flex-col items-center justify-center space-y-16 w-full mt-10">
          <motion.div animate={{ scale: isPlaying ? [1, 1.02, 1] : 1 }} transition={{ repeat: Infinity, duration: 2 }}>
            <svg viewBox="0 0 200 100" className="w-48 h-24 text-zinc-800">
              <path d="M10 50 H40 L55 20 L70 80 L85 10 L100 90 L115 20 L130 80 L145 40 L160 50 H190" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
          
          <div className="text-center space-y-2">
            <h1 className="font-display text-5xl tracking-tight distressed-text uppercase">{songTitle}</h1>
            <input
              type="text" value={artistName} onChange={(e) => setArtistName(e.target.value.toUpperCase())}
              className="bg-transparent border-none text-center font-mono text-[10px] tracking-[0.4em] text-zinc-500 uppercase font-bold focus:outline-none focus:text-white transition-colors w-full"
              placeholder="ENTER ARTIST NAME"
            />
          </div>
        </div>
      </div>

      {/* Controls & Progress */}
      <div className="w-full pb-20 px-8 space-y-12">
        <div className="flex items-center justify-center">
          <button onClick={() => setIsPlaying(!isPlaying)} className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-transform">
            {isBuffering ? <Loader2 className="animate-spin" size={28} /> : (isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />)}
          </button>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between h-16 gap-[1px] cursor-pointer relative" onClick={handleSeek}>
            <div className="absolute top-0 bottom-0 w-[2px] bg-white z-10 shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ left: `${(smoothTime / duration) * 100}%` }} />
            {staticWaveform.map((h, i) => (
              <div key={i} style={{ height: `${h * 100}%`, backgroundColor: (i / WAVEFORM_BARS) <= (smoothTime / duration) ? '#ffffff' : '#18181b' }} className="flex-1 rounded-full" />
            ))}
          </div>
          <div className="flex justify-between font-mono text-xs tracking-widest text-zinc-500 font-bold">
            <span>{formatTime(smoothTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
