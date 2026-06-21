/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, DragEvent } from 'react';
import { X, Upload, FileCode, Check, AlertCircle, Film, Image as ImageIcon } from 'lucide-react';
import { createPostInDB, User, Post } from '../db';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onUploadSuccess: () => void;
  onRequestAuth: () => void;
}

export default function UploadModal({ isOpen, onClose, currentUser, onUploadSuccess, onRequestAuth }: UploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'video' | 'image' | null>(null);
  const [caption, setCaption] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (selectedFile: File) => {
    setError(null);
    setSuccess(null);
    
    const isImage = selectedFile.type.startsWith('image/');
    const isVideo = selectedFile.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      setError('Por favor, envie apenas arquivos de vídeo (mp4, webm) ou imagem (jpg, png, webp).');
      return;
    }

    // Alerta de desempenho se o arquivo for muito grande
    const maxSize = isVideo ? 25 * 1024 * 1024 : 8 * 1024 * 1024; // 25MB para vídeo, 8MB para imagem
    if (selectedFile.size > maxSize) {
      setError(`Aviso: O arquivo é muito grande (${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB). Para garantir velocidade máxima no navegador local, use mídias menores que ${isVideo ? '25MB' : '8MB'}.`);
      return;
    }

    setFile(selectedFile);
    setFileType(isImage ? 'image' : 'video');

    // Gerar URL de exibição imediata (ObjectURL)
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!currentUser) {
      setError('Você precisa estar conectado para publicar.');
      onRequestAuth();
      return;
    }

    if (!file || !fileType) {
      setError('Por favor, selecione um arquivo de vídeo ou imagem.');
      return;
    }

    setLoading(true);

    try {
      // Converter arquivo real para base64
      const reader = new FileReader();
      
      const fileLoadPromise = new Promise<string>((resolve, reject) => {
        reader.onload = (event) => {
          if (event.target?.result) {
            resolve(event.target.result as string);
          } else {
            reject(new Error('Falha ao ler o arquivo.'));
          }
        };
        reader.onerror = () => reject(new Error('Erro na leitura do arquivo.'));
        reader.readAsDataURL(file);
      });

      const base64Data = await fileLoadPromise;

      const newPost: Post = {
        id: 'post_' + Date.now(),
        userId: currentUser.id,
        username: currentUser.username,
        userProfilePic: currentUser.profilePic,
        type: fileType,
        mediaData: base64Data,
        caption: caption.trim(),
        createdAt: Date.now(),
        likes: [],
        comments: []
      };

      await createPostInDB(newPost);
      
      setSuccess('Publicação realizada com sucesso!');
      
      // Limpar formulário
      setFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setFileType(null);
      setCaption('');

      setTimeout(() => {
        onUploadSuccess();
        onClose();
        setSuccess(null);
      }, 1000);

    } catch (err: any) {
      setError(err.message || 'Erro ao publicar seu arquivo. Tente um arquivo menor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="upload_modal_overlay">
      <div 
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
        id="upload_modal_container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Upload className="w-5 h-5 text-rose-500" />
            Nova Publicação
          </h3>
          <button 
            type="button"
            className="p-1 px-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            onClick={onClose}
            id="close_upload_modal_btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 bg-red-900/30 border border-red-800 text-red-200 p-3 rounded-xl text-sm flex items-start gap-2" id="upload_error">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-emerald-950/40 border border-emerald-800 text-emerald-200 p-3 rounded-xl text-sm flex items-center gap-2" id="upload_success">
              <Check className="w-5 h-5 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          {!currentUser ? (
            <div className="text-center py-12 space-y-4">
              <Upload className="w-16 h-16 text-zinc-600 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-white font-bold text-lg">Faça login para publicar</h4>
                <p className="text-sm text-zinc-400">Você precisa estar conectado na sua conta pessoal do MyVideoXXX para postar mídias.</p>
              </div>
              <button
                type="button"
                onClick={onRequestAuth}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all"
                id="upload_auth_trigger_btn"
              >
                Entrar ou Criar conta
              </button>
            </div>
          ) : (
            <form onSubmit={handlePublish} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Área de Seleção de Vídeo/Imagem */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Mídia (Vídeo ou Imagem)</label>
                
                {!previewUrl ? (
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[280px] ${dragActive ? 'border-rose-500 bg-rose-950/10' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'}`}
                    id="drop_zone"
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleChange}
                      accept="video/*,image/*"
                      className="hidden"
                      id="upload_file_input"
                    />
                    
                    <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 text-rose-500 mb-4 shadow-inner">
                      <Upload className="w-6 h-6" />
                    </div>

                    <p className="text-sm font-semibold text-zinc-200">Arraste seus vídeos/fotos ou clique para buscar</p>
                    <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                      Formatos: MP4, WebM, OGG, JPG, PNG, WEBP.<br/>
                      Os vídeos serão reproduzidos no feed em loop contínuo.
                    </p>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 aspect-[4/5] sm:aspect-square md:aspect-[4/5] flex items-center justify-center group" id="upload_preview_container">
                    {fileType === 'video' ? (
                      <video 
                        src={previewUrl} 
                        controls 
                        className="w-full h-full object-contain" 
                        autoPlay 
                        muted 
                        loop
                      />
                    ) : (
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-full h-full object-contain" 
                      />
                    )}
                    
                    {/* Informações detalhadas do arquivo */}
                    <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md text-[10px] text-zinc-300 px-2 py-1 rounded-lg flex items-center gap-1">
                      {fileType === 'video' ? <Film className="w-3" /> : <ImageIcon className="w-3" />}
                      <span className="max-w-[120px] truncate">{file?.name}</span>
                      <span>•</span>
                      <span>{file ? (file.size / (1024 * 1024)).toFixed(1) : 0} MB</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        if (previewUrl) {
                          URL.revokeObjectURL(previewUrl);
                          setPreviewUrl(null);
                        }
                        setFileType(null);
                      }}
                      className="absolute top-3 right-3 bg-black/75 hover:bg-zinc-800 text-white p-1.5 rounded-full transition-all border border-zinc-800 shadow-md"
                      title="Excluir arquivo selecionado"
                      id="delete_selected_file_btn"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Descrição e Confirmação */}
              <div className="flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  {/* Autor */}
                  <div className="flex items-center gap-2.5 p-3.5 bg-zinc-950 rounded-xl border border-zinc-800/60">
                    <div className="w-10 h-10 rounded-full border border-zinc-700 bg-zinc-800 overflow-hidden shrink-0">
                      {currentUser.profilePic ? (
                        <img src={currentUser.profilePic} alt={currentUser.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-rose-950/30 flex items-center justify-center text-rose-500 font-bold uppercase text-sm">
                          {currentUser.username[0]}
                        </div>
                      )}
                    </div>
                    <div>
                      <h5 className="text-zinc-200 font-bold text-sm">@{currentUser.username}</h5>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-widest leading-none">Publicar autorizado</p>
                    </div>
                  </div>

                  {/* Legenda */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Legenda da Publicação</label>
                    <textarea
                      placeholder="Adicione uma legenda ou hashtags para motivar seu público..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      rows={5}
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl py-3 px-3 text-sm text-white outline-none transition-all placeholder:text-zinc-600 resize-none"
                      id="upload_caption_textarea"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-zinc-800">
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Ao publicar, a imagem/vídeo ficará disponível no feed de todos os visitantes reais. Nenhum dado gerado é modificado automaticamente por robôs.
                  </p>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={onClose}
                      className="flex-1 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                      id="cancel_publish_btn"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !file}
                      className="flex-1 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl py-2.5 text-sm font-bold tracking-wide active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-rose-950/20"
                      id="submit_publish_btn"
                    >
                      {loading ? 'Publicando...' : 'Publicar Agora'}
                    </button>
                  </div>
                </div>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
}
