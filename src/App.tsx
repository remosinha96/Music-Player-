/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, SkipBack, SkipForward, Upload, Video, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Custom Waveform Icon to match the image exactly
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

// Generate a dense waveform pattern for the footer
const FOOTER_WAVEFORM_BARS = 100;
const generateFooterWaveform = () => {
  return Array.from({ length: FOOTER_WAVEFORM_BARS }, () => Math.random() * 0.6 + 0.2);
};

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [songTitle, setSongTitle] = useState('KYA KAROON');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [artistName, setArtistName] = useState('ZAALIMA RECORDS');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const footerWaveform = useMemo(() => generateFooterWaveform(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Sync audio state with React state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (isRecording) {
        setRecordingProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      if (isRecording) {
        stopVideoRecording();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isRecording]);

  // Handle Play/Pause
  useEffect(() => {
    if (isPlaying) {
      audioRef.current?.play().catch(() => setIsPlaying(false));
    } else {
      audioRef.current?.pause();
    }
  }, [isPlaying]);

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

  const handleSeek = (e: React.MouseEvent) => {
    if (!audioRef.current || duration === 0 || isRecording) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newProgress = x / rect.width;
    audioRef.current.currentTime = newProgress * duration;
  };

  // Canvas Rendering for Video Export
  const drawFrame = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number, totalDuration: number) => {
    // 1. Background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const progress = totalDuration > 0 ? time / totalDuration : 0;

    // 2. Central Icon
    ctx.save();
    ctx.translate(width / 2, height * 0.35);
    const scale = isPlaying ? 1 + Math.sin(Date.now() / 300) * 0.02 : 1;
    ctx.scale(scale * 2.5, scale * 2.5); // Scale up for 1080p
    ctx.strokeStyle = '#71717a';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const path = [
      [10, 50], [40, 50], [55, 20], [70, 80], [85, 10], 
      [100, 90], [115, 20], [130, 80], [145, 40], [160, 50], [190, 50]
    ];
    ctx.translate(-100, -50);
    ctx.moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i][0], path[i][1]);
    }
    ctx.stroke();
    ctx.restore();

    // 3. Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px Anton'; // Large for 1080p
    ctx.textAlign = 'center';
    ctx.letterSpacing = '-2px';
    ctx.fillText(songTitle, width / 2, height * 0.55);

    // 3.5 Artist Name
    ctx.fillStyle = '#71717a';
    ctx.font = 'bold 24px Space Grotesk';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '8px';
    ctx.fillText(artistName, width / 2, height * 0.60);

    // 4. Footer Waveform
    const footerY = height * 0.85;
    const footerHeight = 120;
    const barGap = 4;
    const totalBars = FOOTER_WAVEFORM_BARS;
    const barWidth = (width - 160 - (totalBars - 1) * barGap) / totalBars;
    
    ctx.save();
    ctx.translate(80, footerY);
    footerWaveform.forEach((h, i) => {
      const barProgress = i / totalBars;
      ctx.fillStyle = barProgress <= progress ? '#f4f4f5' : '#27272a';
      const bh = h * footerHeight;
      ctx.beginPath();
      ctx.roundRect(i * (barWidth + barGap), (footerHeight - bh) / 2, barWidth, bh, 4);
      ctx.fill();
    });
    ctx.restore();

    // 5. Playhead
    ctx.fillStyle = '#71717a';
    ctx.fillRect(80 + progress * (width - 160), footerY, 4, footerHeight);

    // 6. Timestamps
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Space Grotesk';
    ctx.textAlign = 'left';
    ctx.fillText(formatTime(time), 80, footerY + footerHeight + 60);
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(totalDuration), width - 80, footerY + footerHeight + 60);
  };

  const startVideoRecording = async () => {
    if (!audioRef.current || duration === 0) return;
    
    setIsRecording(true);
    setRecordingProgress(0);
    
    // Setup Audio Context for reliable capture if not already setup
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
      audioSourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      audioDestinationRef.current = audioContextRef.current.createMediaStreamDestination();
      audioSourceRef.current.connect(audioDestinationRef.current);
      audioSourceRef.current.connect(audioContextRef.current.destination);
    }

    // Ensure context is running
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    // Reset audio
    audioRef.current.currentTime = 0;
    
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    
    // Capture Stream - Use 30 FPS for better stability during encoding
    const canvasStream = canvas.captureStream(30); 
    
    // Audio Stream from AudioContext destination
    const audioStream = audioDestinationRef.current!.stream;
    
    // Combine Streams
    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioStream.getAudioTracks()
    ]);

    // Use a more widely supported codec and slightly lower bitrate for stability
    const recorder = new MediaRecorder(combinedStream, {
      mimeType: 'video/webm;codecs=vp8,opus',
      videoBitsPerSecond: 5000000 // 5Mbps is plenty for this minimalist UI
    });

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${songTitle.toLowerCase()}-reel.webm`;
      link.href = url;
      link.click();
      setIsRecording(false);
    };

    mediaRecorderRef.current = recorder;
    
    // Small delay to ensure streams are ready
    setTimeout(() => {
      recorder.start(100); // Collect data in 100ms chunks
      setIsPlaying(true);

      // Animation Loop
      const renderLoop = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          drawFrame(ctx, canvas.width, canvas.height, audioRef.current?.currentTime || 0, duration);
          requestAnimationFrame(renderLoop);
        }
      };
      renderLoop();
    }, 200);
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
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
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="audio/*" 
        className="hidden" 
      />
      
      {/* Hidden Canvas for 1080x1920 Export */}
      <canvas 
        ref={canvasRef} 
        width={1080} 
        height={1920} 
        className="hidden" 
      />

      {/* Recording Overlay */}
      <AnimatePresence>
        {isRecording && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center space-y-8 p-12 text-center"
          >
            <div className="w-24 h-24 rounded-full border-4 border-zinc-800 border-t-white animate-spin" />
            <div className="space-y-2">
              <h2 className="text-2xl font-display uppercase tracking-widest">Exporting Video</h2>
              <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Resolution: 1080x1920 | 30 FPS</p>
            </div>
            
            <div className="w-full max-w-xs bg-zinc-900 h-1 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-white"
                initial={{ width: 0 }}
                animate={{ width: `${recordingProgress}%` }}
              />
            </div>
            
            <button 
              onClick={stopVideoRecording}
              className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-full text-xs font-mono uppercase tracking-widest flex items-center space-x-2"
            >
              <X size={14} />
              <span>Cancel Export</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Menu Bar */}
      <div className="w-full px-6 py-4 flex justify-between items-center z-50">
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center space-x-2 text-zinc-500 hover:text-white transition-colors text-xs font-mono tracking-widest uppercase"
        >
          <Upload size={14} />
          <span>Load MP3</span>
        </button>
        <button 
          onClick={startVideoRecording}
          disabled={duration === 0}
          className="flex items-center space-x-2 text-zinc-500 hover:text-white transition-colors text-xs font-mono tracking-widest uppercase disabled:opacity-30"
        >
          <Video size={14} />
          <span>Export Video</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 w-full flex flex-col items-center justify-between bg-black">
        {/* Top Section: Header/Icon */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-16 w-full mt-10">
          <motion.div
            animate={{ scale: isPlaying ? [1, 1.02, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          >
            <CentralWaveIcon isPlaying={isPlaying} color="#71717a" />
          </motion.div>

          <div className="text-center space-y-1">
            <motion.h1
              className="font-display text-5xl tracking-tight distressed-text uppercase"
            >
              {songTitle}
            </motion.h1>
            <input
              type="text"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value.toUpperCase())}
              className="bg-transparent border-none text-center font-mono text-[10px] tracking-[0.4em] text-zinc-500 uppercase font-bold focus:outline-none focus:text-white transition-colors w-full"
              placeholder="ENTER ARTIST NAME"
            />
          </div>
        </div>

        {/* Middle: Controls */}
        <div className="py-8 flex items-center justify-center space-x-12">
          <button className="text-zinc-600 hover:text-zinc-400 transition-colors">
            <SkipBack size={28} />
          </button>
          
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/5"
          >
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div key="pause" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Pause size={24} fill="currentColor" />
                </motion.div>
              ) : (
                <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="ml-1">
                  <Play size={24} fill="currentColor" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          <button className="text-zinc-600 hover:text-zinc-400 transition-colors">
            <SkipForward size={28} />
          </button>
        </div>

        {/* Bottom Footer: Waveform Progress Bar */}
        <div className="w-full bg-black border-t border-zinc-900 pt-6 pb-12 px-8 relative">
          <div className="max-w-xl mx-auto space-y-4">
            <div 
              className="flex items-center justify-between h-12 gap-[1px] cursor-pointer relative"
              onClick={handleSeek}
            >
              {/* Vertical Playhead Line */}
              <div 
                className="absolute top-0 bottom-0 w-[2px] bg-zinc-500 z-10"
                style={{ left: `${progress * 100}%` }}
              />

              {footerWaveform.map((height, i) => {
                const barProgress = i / FOOTER_WAVEFORM_BARS;
                const isActive = barProgress <= progress;
                
                return (
                  <div
                    key={i}
                    style={{ 
                      height: `${height * 100}%`,
                      backgroundColor: isActive ? '#f4f4f5' : '#27272a'
                    }}
                    className="flex-1 rounded-sm transition-colors duration-150"
                  />
                );
              })}
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
