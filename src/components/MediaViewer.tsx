/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut, Download, Play, Pause, Volume2, VolumeX, Maximize2, RotateCw } from 'lucide-react';
import { Post } from '../db';

interface MediaViewerProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function MediaViewer({ post, isOpen, onClose }: MediaViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal' | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [rotation, setRotation] = useState(0); // For rotating the media manually if they wish
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset controls state on post change or close
  useEffect(() => {
    setZoom(1);
    setOrientation(null);
    setIsPlaying(true);
    setRotation(0);
  }, [post, isOpen]);

  if (!isOpen || !post) return null;

  // Handle Image load to determine aspect ratio and orientation
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const isVertical = img.naturalHeight > img.naturalWidth;
    setOrientation(isVertical ? 'vertical' : 'horizontal');
  };

  // Handle Video load to determine metadata aspect ratio
  const handleVideoMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = e.currentTarget;
    const isVertical = vid.videoHeight > vid.videoWidth;
    setOrientation(isVertical ? 'vertical' : 'horizontal');
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.5, 1));
  };

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = post.mediaData;
    // Extract format from base64
    const formatMatch = post.mediaData.match(/[^:/!\\\s]+(?=;base64)/);
    const format = formatMatch ? formatMatch[0] : (post.type === 'video' ? 'mp4' : 'jpg');
    link.download = `my_video_xxx_${post.username}_${post.id}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotation(prev => (prev + 90) % 360);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/98 backdrop-blur-md z-[100] flex flex-col justify-between select-none animate-fade-in text-[#fafafa]"
      onClick={onClose}
      id="media_viewer_modal"
    >
      {/* 1. TOP BAR */}
      <header className="p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-full text-zinc-400 capitalize">
            {post.type === 'video' ? 'Vídeo Autêntico' : 'Imagem de Criador'}
          </span>
          {orientation && (
            <span className="text-[10px] sm:text-xs text-zinc-500 font-medium">
              Orientation: {orientation === 'vertical' ? 'Vertical 9:16' : 'Horizontal 16:9'}
            </span>
          )}
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-2">
          {post.type === 'image' && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
                className="p-2 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/60 rounded-full text-zinc-300 transition cursor-pointer"
                title="Ampliar Zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
                className="p-2 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/60 rounded-full text-zinc-300 transition cursor-pointer"
                title="Reduzir Zoom"
                disabled={zoom === 1}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
            </>
          )}

          <button 
            onClick={handleRotate}
            className="p-2 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/60 rounded-full text-zinc-300 transition cursor-pointer"
            title="Girar Visualização"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button 
            onClick={handleDownload}
            className="p-2 bg-white text-black hover:bg-zinc-200 rounded-full font-bold transition flex items-center gap-1.5 text-xs px-3 py-1.5 cursor-pointer shadow-lg"
            title="Baixar em Qualidade Original"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Baixar Original</span>
          </button>

          <button 
            onClick={onClose}
            className="p-2 bg-zinc-905 border border-zinc-800 hover:bg-zinc-800 rounded-full text-white transition cursor-pointer"
            title="Fechar Visualizador"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. CENTRAL MEDIA DISPLAY STAGE */}
      <div 
        className="flex-1 flex items-center justify-center overflow-hidden p-4 relative"
        onClick={onClose}
      >
        <div 
          className={`relative transition-all duration-300 flex items-center justify-center max-h-full max-w-full ${
            orientation === 'vertical' 
              ? 'aspect-[9/16] h-[85vh] max-h-[90vh]' 
              : 'aspect-video w-full max-w-5xl h-auto'
          }`}
          style={{ 
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            pointerEvents: zoom > 1 ? 'auto' : 'none'
          }}
          onClick={(e) => {
            // Se estiver em zoom, clique não fecha, apenas segura
            if (zoom > 1) {
              e.stopPropagation();
            }
          }}
        >
          {post.type === 'video' ? (
            <video
              ref={videoRef}
              src={post.mediaData}
              autoPlay
              playsInline
              loop
              onLoadedMetadata={handleVideoMetadata}
              className="object-contain max-h-full max-w-full w-full h-full rounded-xl bg-black"
              onClick={togglePlay}
            />
          ) : (
            <img
              src={post.mediaData}
              alt={post.caption || "Mídia"}
              onLoad={handleImageLoad}
              className="object-contain max-h-full max-w-full w-full h-full rounded-xl select-none"
              draggable="false"
            />
          )}

          {/* Floating actions indicators for zoom and visual cue */}
          {zoom > 1 && (
            <div className="absolute top-4 inset-x-0 mx-auto w-max bg-black/85 text-xs text-zinc-400 border border-zinc-800 px-3 py-1.5 rounded-full pointer-events-none">
              Zoom Ativo ({zoom}x). Dê zoom-out para reajustar.
            </div>
          )}
        </div>

        {/* Video Overlays Controls */}
        {post.type === 'video' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 border border-zinc-800/65 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-3 z-20">
            <button
              onClick={togglePlay}
              className="p-1.5 text-white hover:text-red-500 transition-colors cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>
            <button
              onClick={toggleMute}
              className="p-1.5 text-white hover:text-red-500 transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <span className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase border-l border-zinc-800 pl-3">
              Modo Cinema
            </span>
          </div>
        )}
      </div>

      {/* 3. FOOTER INFO BAR */}
      <footer className="p-6 bg-gradient-to-t from-black/95 to-transparent text-left z-10">
        <div className="max-w-3xl mx-auto flex sm:items-center justify-between gap-4 flex-col sm:flex-row">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-white">@{post.username}</span>
              <span className="w-1 h-1 bg-zinc-700 rounded-full"></span>
              <span className="text-[10px] text-zinc-500 font-semibold">{new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
            {post.caption && (
              <p className="text-xs text-zinc-350 leading-relaxed max-w-xl">{post.caption}</p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900 border border-zinc-850 px-3 py-1 rounded-lg">
              {post.likes.length} Curtidas
            </span>
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900 border border-zinc-850 px-3 py-1 rounded-lg">
              {post.comments.length} Comentários
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
