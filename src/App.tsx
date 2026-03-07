/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Upload, Video, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Custom Waveform Icon
const CentralWaveIcon = ({ isPlaying, color = "currentColor" }: { isPlaying: boolean, color?: string }) => (
  <motion.svg
    viewBox="0 0 200 100"
    className="w-48 h-24"
    style={{ color }}
    animate={{ scale: isPlaying ? [1, 1.02, 1] : 1 }}
    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
  >
    <path
      d="M10 50 H40 L55 20 L70 80 L85 10 L100 90 L115 20 L130 80 L145 40 L160 50 H190"
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </motion.svg>
);

const FOOTER_WAVEFORM_BARS = 100;
const generateFooterWaveform = () => {
  return Array.from({ length: FOOTER_WAVEFORM_BARS }, () => Math.random() * 0.6 + 0.2);
};

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [songTitle, setSongTitle] = useState('KYA KAROON');
  const [artistName, setArtistName] = useState('ZAALIMA RECORDS');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const footerWaveform = useMemo(() => generateFooterWaveform(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Audio Engineering Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  // Initialize Audio Engine with High Fidelity Settings
  const initAudioEngine = () => {
    if (audioContextRef.current) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass({
      latencyHint: 'playback',
      sampleRate: 44100,
    });

    const source = ctx.createMediaElementSource(audioRef.current!);
    const destination = ctx.createMediaStreamDestination();
    const compressor = ctx.createDynamicsCompressor();
    const masterGain = ctx.createGain();

    // Professional Compression Settings
    compressor.threshold.setValueAtTime(-24, ctx.currentTime);
    compressor.knee.setValueAtTime(30, ctx.currentTime);
    compressor.ratio.setValueAtTime(12, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.25, ctx.currentTime);

    source.connect(compressor);
    compressor.connect(destination);
    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    audioContextRef.current = ctx;
    audioSourceRef.current = source;
    audioDestinationRef.current = destination;
    compressorRef.current = compressor;
    masterGainRef.current = masterGain;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      
      if (isRecording) {
        setRecordingProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleCanPlay = () => setIsBuffering(false);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsBuffering(false);
    };

    const handleError = () => {
      setIsBuffering(false);
      setIsPlaying(false);
      console.error("Audio error occurred");
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (isRecording) stopVideoRecording();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [isRecording]);

  useEffect(() => {
    if (isBuffering) {
      const timer = setTimeout(() => setIsBuffering(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isBuffering]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsBuffering(true);
      const url = URL.createObjectURL(file);
      if (audioRef.current) {
        audioRef.current.src = url;
        setSongTitle(file.name.replace(/\.[^/.]+$/, "").toUpperCase());
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (e: React.MouseEvent) => {
    if (!audioRef.current || duration === 0 || isRecording) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newProgress = x / rect.width;
    audioRef.current.currentTime = newProgress * duration;
  };

  const drawFrame = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number, totalDuration: number) => {
    // 1. Background - Solid Black
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const progress = totalDuration > 0 ? time / totalDuration : 0;

    // 2. Central Icon - Optimized Stroke
    ctx.save();
    ctx.translate(width / 2, height * 0.35);
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

    // 3. Typography
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px Anton';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '-2px';
    ctx.fillText(songTitle, width / 2, height * 0.55);

    ctx.fillStyle = '#71717a';
    ctx.font = 'bold 24px Space Grotesk';
    ctx.letterSpacing = '8px';
    ctx.fillText(artistName, width / 2, height * 0.60);

    // 4. Waveform Progress - Optimized Rendering
    const footerY = height * 0.85;
    const footerHeight = 120;
    const barGap = 4;
    const barWidth = (width - 160 - (FOOTER_WAVEFORM_BARS - 1) * barGap) / FOOTER_WAVEFORM_BARS;
    
    ctx.save();
    ctx.translate(80, footerY);
    footerWaveform.forEach((h, i) => {
      const barProgress = i / FOOTER_WAVEFORM_BARS;
      ctx.fillStyle = barProgress <= progress ? '#ffffff' : '#18181b';
      const bh = h * footerHeight;
      ctx.beginPath();
      ctx.roundRect(i * (barWidth + barGap), (footerHeight - bh) / 2, barWidth, bh, 4);
      ctx.fill();
    });
    ctx.restore();

    // 5. Playhead
    ctx.fillStyle = '#52525b';
    ctx.fillRect(80 + progress * (width - 160), footerY, 3, footerHeight);

    // 6. Timestamps - High Contrast
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Space Grotesk';
    ctx.textAlign = 'left';
    ctx.fillText(formatTime(time), 80, footerY + footerHeight + 60);
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(totalDuration), width - 80, footerY + footerHeight + 60);
  };

  const startVideoRecording = async () => {
    if (!audioRef.current || duration === 0) return;
    
    initAudioEngine();
    setIsRecording(true);
    setRecordingProgress(0);
    
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    // Mute speakers during export so user doesn't hear it
    if (masterGainRef.current) {
      masterGainRef.current.gain.setValueAtTime(0, audioContextRef.current!.currentTime);
    }

    audioRef.current.currentTime = 0;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    
    const canvasStream = canvas.captureStream(30); 
    const audioStream = audioDestinationRef.current!.stream;
    
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioStream.getAudioTracks()
    ]);

    const getSupportedMimeType = () => {
      const types = [
        'video/mp4;codecs=h264,aac',
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];
      return types.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
    };

    const mimeType = getSupportedMimeType();
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';

    const recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 5000000 
    });

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    
    recorder.onstop = () => {
      // Restore volume after export
      if (masterGainRef.current && audioContextRef.current) {
        masterGainRef.current.gain.setValueAtTime(1, audioContextRef.current.currentTime);
      }
      
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${songTitle.toLowerCase()}-reel.${extension}`;
      link.href = url;
      link.click();
      setIsRecording(false);
    };

    mediaRecorderRef.current = recorder;
    
    // Start immediately for faster response
    recorder.start(200); 
    setIsPlaying(true);

    const renderLoop = () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        drawFrame(ctx, canvas.width, canvas.height, audioRef.current?.currentTime || 0, duration);
        requestAnimationFrame(renderLoop);
      }
    };
    renderLoop();
  };

  const stopVideoRecording = () => {
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
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-between select-none overflow-hidden font-sans">
      <audio ref={audioRef} className="hidden" crossOrigin="anonymous" />
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="audio/*" className="hidden" />
      <canvas ref={canvasRef} width={1080} height={1920} className="hidden" />

      {/* Recording Overlay */}
      <AnimatePresence>
        {isRecording && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center space-y-8 p-12 text-center"
          >
            <Loader2 className="w-16 h-16 text-white animate-spin" />
            <div className="space-y-2">
              <h2 className="text-2xl font-display uppercase tracking-widest">Mastering Export</h2>
              <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">High Fidelity Audio | 1080p 30FPS</p>
            </div>
            <div className="w-full max-w-xs bg-zinc-900 h-1 rounded-full overflow-hidden">
              <motion.div className="h-full bg-white" initial={{ width: 0 }} animate={{ width: `${recordingProgress}%` }} />
            </div>
            <button onClick={stopVideoRecording} className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-full text-xs font-mono uppercase tracking-widest flex items-center space-x-2">
              <X size={14} /> <span>Cancel</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Menu */}
      <div className="w-full px-6 py-4 flex justify-between items-center z-50">
        <button onClick={() => fileInputRef.current?.click()} className="flex items-center space-x-2 text-zinc-500 hover:text-white transition-colors text-xs font-mono tracking-widest uppercase">
          <Upload size={14} /> <span>Load MP3</span>
        </button>
        <button onClick={startVideoRecording} disabled={duration === 0} className="flex items-center space-x-2 text-zinc-500 hover:text-white transition-colors text-xs font-mono tracking-widest uppercase disabled:opacity-30">
          <Video size={14} /> <span>Export Reel</span>
        </button>
      </div>

      {/* Main UI */}
      <div className="flex-1 w-full flex flex-col items-center justify-between">
        <div className="flex-1 flex flex-col items-center justify-center space-y-16 w-full mt-10">
          <motion.div animate={{ scale: isPlaying ? [1, 1.02, 1] : 1 }} transition={{ repeat: Infinity, duration: 2 }}>
            <CentralWaveIcon isPlaying={isPlaying} color="#27272a" />
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

        {/* Controls */}
        <div className="py-8 flex items-center justify-center space-x-12">
          <button className="text-zinc-800 hover:text-zinc-600 transition-colors"><SkipBack size={28} /></button>
          <button onClick={() => setIsPlaying(!isPlaying)} className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 transition-all">
            {isBuffering ? <Loader2 className="animate-spin" size={24} /> : (isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />)}
          </button>
          <button className="text-zinc-800 hover:text-zinc-600 transition-colors"><SkipForward size={28} /></button>
        </div>

        {/* Footer Waveform */}
        <div className="w-full bg-black border-t border-zinc-900 pt-6 pb-12 px-8">
          <div className="max-w-xl mx-auto space-y-4">
            <div className="flex items-center justify-between h-12 gap-[1px] cursor-pointer relative" onClick={handleSeek}>
              <div className="absolute top-0 bottom-0 w-[2px] bg-white z-10 shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ left: `${progress * 100}%` }} />
              {footerWaveform.map((h, i) => (
                <div key={i} style={{ height: `${h * 100}%`, backgroundColor: (i / FOOTER_WAVEFORM_BARS) <= progress ? '#ffffff' : '#18181b' }} className="flex-1 rounded-sm" />
              ))}
            </div>
            <div className="flex justify-between font-mono text-[10px] tracking-widest text-zinc-500 font-bold px-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
