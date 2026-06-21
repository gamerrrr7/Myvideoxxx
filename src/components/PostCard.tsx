/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Play, Pause, VolumeX, Volume2, Send, Trash2, Check, Maximize2, Download, Edit, AlertTriangle, Flag, X } from 'lucide-react';
import { Post, User, updatePostInDB, deletePostFromDB, reportPostInDB } from '../db';

interface PostCardProps {
  key?: string;
  post: Post;
  currentUser: User | null;
  onPostUpdate: () => void;
  onRequestAuth: () => void;
  onSelectMedia?: (post: Post) => void;
}

export default function PostCard({ post, currentUser, onPostUpdate, onRequestAuth, onSelectMedia }: PostCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [videoMuted, setVideoMuted] = useState(true);
  const [shareToast, setShareToast] = useState(false);
  
  // Exclusão e Modificações
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCaption, setEditedCaption] = useState(post.caption);
  
  // Denúncias e Moderação
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);
  const [revealSpamField, setRevealSpamField] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // Verificar se o usuário atual curtiu o post
  useEffect(() => {
    if (currentUser) {
      setIsLiked(post.likes.includes(currentUser.id));
    } else {
      setIsLiked(false);
    }
  }, [post.likes, currentUser]);

  const handleLike = async () => {
    if (!currentUser) {
      onRequestAuth();
      return;
    }

    try {
      let updatedLikes = [...post.likes];
      if (isLiked) {
        // Descurtir
        updatedLikes = updatedLikes.filter(id => id !== currentUser.id);
      } else {
        // Curtir
        updatedLikes.push(currentUser.id);
      }

      const updatedPost: Post = {
        ...post,
        likes: updatedLikes
      };

      await updatePostInDB(updatedPost);
      onPostUpdate();
    } catch (err) {
      console.error('Erro ao curtir post: ', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequestAuth();
      return;
    }

    if (!commentText.trim()) return;

    try {
      const newComment = {
        id: 'comment_' + Date.now(),
        userId: currentUser.id,
        username: currentUser.username,
        userProfilePic: currentUser.profilePic,
        text: commentText.trim(),
        createdAt: Date.now()
      };

      const updatedPost: Post = {
        ...post,
        comments: [...post.comments, newComment]
      };

      await updatePostInDB(updatedPost);
      setCommentText('');
      onPostUpdate();
    } catch (err) {
      console.error('Erro ao adicionar comentário: ', err);
    }
  };

  const toggleVideoMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !videoMuted;
      setVideoMuted(!videoMuted);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}${window.location.pathname}?post=${post.id}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2500);
      });
    } else {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    }
  };

  // Baixar com 100% de qualidade e suporte a arquivos grandes sem travamentos (Blob support!)
  const handleDownloadDirect = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    let downloadUrl = post.mediaData;
    let isCreatedUrl = false;

    // Se tivermos o arquivo binário puro (Blob original) armazenado localmente para downloads rápidos:
    if ((post as any).mediaBlob instanceof Blob) {
      downloadUrl = URL.createObjectURL((post as any).mediaBlob);
      isCreatedUrl = true;
    }

    const link = document.createElement('a');
    link.href = downloadUrl;
    
    // Auto-detectar formato correto de download
    let extension = post.type === 'video' ? 'mp4' : 'jpg';
    if (post.mediaData.startsWith('data:')) {
      const formatMatch = post.mediaData.match(/[^:/!\\\s]+(?=;base64)/);
      if (formatMatch) extension = formatMatch[0];
    } else if ((post as any).mediaBlob instanceof Blob) {
      const mime = (post as any).mediaBlob.type;
      const parsedExt = mime.split('/')[1];
      if (parsedExt) extension = parsedExt;
    }
    
    link.download = `myvideoxxx_${post.username}_post_${post.id}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (isCreatedUrl) {
      // Liberar memória do browser
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    }
  };

  const executeDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deletePostFromDB(post.id);
      onPostUpdate();
    } catch (err) {
      console.error('Erro ao excluir:', err);
    } finally {
      setIsConfirmingDelete(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedCaption.trim()) return;

    try {
      const updated: Post = {
        ...post,
        caption: editedCaption.trim()
      };
      await updatePostInDB(updated);
      setIsEditing(false);
      onPostUpdate();
    } catch (err) {
      console.error('Erro ao salvar alteração: ', err);
    }
  };

  const handleReportSubmit = async (reason: string) => {
    if (!currentUser) {
      onRequestAuth();
      return;
    }

    try {
      await reportPostInDB(post.id, currentUser.id, reason);
      setReportSuccess(true);
      setTimeout(() => {
        setIsReporting(false);
        setReportSuccess(false);
        onPostUpdate();
      }, 1500);
    } catch (err) {
      console.error('Erro ao denunciar: ', err);
    }
  };

  const formatDistance = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `Há ${days} ${days === 1 ? 'dia' : 'dias'}`;
    if (hours > 0) return `Há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    if (mins > 0) return `Há ${mins} ${mins === 1 ? 'minuto' : 'minutos'}`;
    return 'Agora mesmo';
  };

  // Caso seja spam, blura e avisa o internauta
  const isSpam = post.isFlaggedSpam;

  if (isSpam && !revealSpamField) {
    return (
      <article className="border border-zinc-800/80 rounded-2xl p-6 bg-zinc-950/80 flex flex-col items-center justify-center text-center gap-3.5 max-w-xl mx-auto" id={`post_card_spam_${post.id}`}>
        <AlertTriangle className="w-9 h-9 text-rose-500 animate-pulse" />
        <div className="space-y-1">
          <h4 className="text-white font-bold text-sm">Publicação Temporariamente Silenciada</h4>
          <p className="text-xs text-zinc-500 max-w-sm">
            Este conteúdo recebeu múltiplas denúncias de spam ou violação das diretrizes de MyVideoXXX e foi ocultado para proteger a comunidade.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setRevealSpamField(true)}
            className="text-xs bg-zinc-850 hover:bg-zinc-800 text-zinc-350 font-bold px-4 py-2 rounded-xl border border-zinc-800 transition-all cursor-pointer"
          >
            Revelar Conteúdo
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="glass-panel rounded-2xl overflow-hidden shadow-2xl flex flex-col w-full max-w-xl mx-auto relative hover:-translate-y-0.5 transition-transform duration-200" id={`post_card_${post.id}`}>
      
      {/* Cabeçalho do Card */}
      <div className="p-4 flex items-center justify-between border-b border-zinc-800/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-zinc-800 bg-[#09090b] flex items-center justify-center overflow-hidden shrink-0">
            {post.userProfilePic ? (
              <img src={post.userProfilePic} alt={post.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-red-950/20 flex items-center justify-center text-red-500 font-bold uppercase text-sm">
                {post.username[0]}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-white text-xs hover:underline cursor-pointer transition-colors">
              @{post.username}
            </span>
            <span className="text-[10px] text-zinc-500 font-medium">
              {formatDistance(post.createdAt)}
            </span>
          </div>
        </div>
        
        {/* Controle de Deletar, Editar, Denunciar e Tipo */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          
          {/* Dono do post edita ou exclui */}
          {currentUser && currentUser.id === post.userId ? (
            <div className="flex items-center gap-1">
              {!isEditing && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                  className="p-1 px-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/50 transition-all cursor-pointer"
                  title="Editar Legenda"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              )}

              {isConfirmingDelete ? (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-950/30 border border-red-900/30 text-[9px] font-bold">
                  <span className="text-red-400">Remover?</span>
                  <button 
                    onClick={executeDelete} 
                    className="text-white hover:text-red-500 hover:underline cursor-pointer"
                  >
                    Sim
                  </button>
                  <span className="text-zinc-650">/</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }} 
                    className="text-zinc-400 hover:text-white hover:underline cursor-pointer"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(true); }}
                  className="p-1 px-1.5 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-red-950/10 transition-all cursor-pointer animate-fade-in"
                  title="Excluir minha publicação"
                  id={`delete_btn_${post.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            /* Visitantes e outros usuários denunciam spam */
            currentUser && (
              <button
                onClick={(e) => { e.stopPropagation(); setIsReporting(true); }}
                className="p-1 px-1.5 rounded-lg text-zinc-500 hover:text-rose-500 hover:bg-rose-950/10 transition-all cursor-pointer"
                title="Denunciar publicação"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            )
          )}

          <span className="text-[10px] font-bold bg-[#09090b] text-zinc-400 border border-zinc-800 px-2 py-0.5 rounded-lg uppercase tracking-wider">
            {post.type === 'video' ? 'Vídeo' : 'Imagem'}
          </span>
        </div>
      </div>

      {/* Media Viewport com suporte a capados lazy previews */}
      <div 
        className="relative bg-black w-full overflow-hidden flex items-center justify-center cursor-pointer aspect-square sm:aspect-video md:aspect-square group"
        onClick={() => onSelectMedia && onSelectMedia(post)}
      >
        {post.type === 'video' ? (
          <div className="w-full h-full flex items-center justify-center relative">
            <video
              ref={videoRef}
              src={post.mediaData}
              loop
              muted={videoMuted}
              playsInline
              autoPlay
              preload="none" // Poupa banda na rede móvel de dados
              poster={(post as any).thumbnailData || undefined} // Usa miniatura gerada sem gastar rede
              className="w-full h-full object-cover"
            />
            
            {/* Hover Indicator overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
              <div className="w-10 h-10 rounded-full bg-black/80 border border-zinc-850 flex items-center justify-center text-white scale-100 transition-all">
                <Maximize2 className="w-5 h-5 text-zinc-200" />
              </div>
            </div>

            {/* Mute/Unmute floating button */}
            <button
              onClick={toggleVideoMute}
              className="absolute bottom-3 right-3 bg-black/75 hover:bg-zinc-900 border border-zinc-800 p-2 rounded-full text-white backdrop-blur-md active:scale-90 transition-all z-10 cursor-pointer"
              title={videoMuted ? "Ativar som" : "Desativar som"}
            >
              {videoMuted ? <VolumeX className="w-3.5 h-3.5 text-zinc-300" /> : <Volume2 className="w-3.5 h-3.5 text-red-500" />}
            </button>
          </div>
        ) : (
          <div className="w-full h-full relative">
            <img
              src={post.mediaData}
              alt={post.caption || "Publicação"}
              className="w-full h-full object-cover select-none"
              loading="lazy"
            />
            {/* Hover Indicator */}
            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
              <div className="w-10 h-10 rounded-full bg-black/80 border border-zinc-850 flex items-center justify-center text-white">
                <Maximize2 className="w-5 h-5 text-zinc-200" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barra de Ações Rápidas */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800/25 pb-3">
          <div className="flex items-center gap-3">
            {/* Like */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all cursor-pointer ${isLiked ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800'}`}
              title="Curtir publicação"
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-current text-red-500' : ''}`} />
              <span>{post.likes.length}</span>
            </button>

            <button
              onClick={() => setShowComments(!showComments)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all cursor-pointer ${showComments ? 'bg-white text-black border border-white' : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800'}`}
              title="Ver comentários"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{post.comments.length}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Download */}
            <button
              onClick={handleDownloadDirect}
              className="flex items-center gap-1.5 text-xs font-bold bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white px-3 py-1.5 rounded-full transition-all cursor-pointer"
              title="Baixar mídia original"
              id={`download_btn_${post.id}`}
            >
              <Download className="w-3.5 h-3.5 text-rose-500" />
              <span className="hidden sm:inline">Baixar (.{post.type === 'video' ? 'mp4' : 'jpg'})</span>
            </button>

            {/* Compartilhar */}
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-xs font-bold bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 px-3 py-1.5 rounded-full transition-all cursor-pointer"
              title="Compartilhar publicação"
              id={`share_btn_${post.id}`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Compartilhar</span>
            </button>
          </div>
        </div>

        {/* Legenda do Post (Edição Inline para o dono) */}
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="space-y-2 animate-fade-in py-1">
            <textarea
              value={editedCaption}
              onChange={(e) => setEditedCaption(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-lg p-2 text-xs text-white outline-none placeholder:text-zinc-700 resize-none"
              rows={2}
              required
            />
            <div className="flex justify-end gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => { setIsEditing(false); setEditedCaption(post.caption); }}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-350 px-2.5 py-1 rounded font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-gradient-to-r from-rose-600 to-pink-600 text-white px-3 py-1 rounded font-bold"
              >
                Salvar
              </button>
            </div>
          </form>
        ) : (
          post.caption && (
            <div className="text-xs text-zinc-200 font-medium leading-relaxed">
              <span className="font-bold text-white mr-1.5">@{post.username}</span>
              {post.caption}
            </div>
          )
        )}

        {/* Seção de comentários */}
        {showComments && (
          <div className="pt-3 border-t border-zinc-800/40 space-y-4 animate-slide-down">
            {/* Lista de Comentários */}
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
              {post.comments.length === 0 ? (
                <p className="text-xs text-zinc-500 italic text-center py-2">
                  Nenhum comentário por enquanto. Seja o primeiro a comentar!
                </p>
              ) : (
                post.comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2.5 items-start bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800/40">
                    <div className="w-8 h-8 rounded-full border border-zinc-800 bg-zinc-900 flex items-center justify-center overflow-hidden shrink-0">
                      {comment.userProfilePic ? (
                        <img src={comment.userProfilePic} alt={comment.username} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-red-950/20 flex items-center justify-center text-red-500 font-bold uppercase text-[10px]">
                          {comment.username[0]}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="font-bold text-[11px] text-zinc-200">@{comment.username}</span>
                        <span className="text-[9px] text-zinc-500 font-medium">{formatDistance(comment.createdAt)}</span>
                      </div>
                      <p className="text-xs text-zinc-350 break-words leading-relaxed">{comment.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Formulário de Enviar Comentário */}
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                placeholder={currentUser ? "Escreva seu comentário legítimo..." : "Conecte-se para comentar..."}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 bg-zinc-905 border border-zinc-800 focus:border-zinc-700 focus:ring-1 focus:ring-zinc-750 rounded-xl py-2 px-3 text-xs text-white outline-none transition-all placeholder:text-zinc-650"
                id={`comment_input_${post.id}`}
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="bg-white hover:bg-zinc-200 text-black disabled:opacity-40 disabled:pointer-events-none aspect-square w-9 rounded-xl flex items-center justify-center transition-all shadow active:scale-95 shrink-0 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-black" />
              </button>
            </form>
          </div>
        )}

      </div>

      {/* Modal / Overlay para seleção de Denúncia */}
      {isReporting && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6 z-30 animate-fade-in">
          <button
            onClick={() => setIsReporting(false)}
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white hover:bg-zinc-905 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-full max-w-sm text-center space-y-4">
            <div className="w-12 h-12 bg-rose-950/30 border border-rose-900/40 rounded-full flex items-center justify-center text-rose-500 mx-auto">
              <Flag className="w-5 h-5" />
            </div>
            
            <div className="space-y-1">
              <h4 className="text-white font-bold text-sm">Denunciar Publicação</h4>
              <p className="text-[11px] text-zinc-500">Ajude a manter o feed do MyVideoXXX livre de abusos filtrando uploads indevidos.</p>
            </div>

            {reportSuccess ? (
              <div className="p-4 bg-emerald-950/40 border border-emerald-900/40 rounded-2xl animate-scale-up">
                <Check className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
                <p className="text-xs text-emerald-250 font-semibold">Suas considerações foram salvas. Nossos moderadores analisarão o post.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 pt-2 text-left text-xs">
                {[
                  'Spam, bots ou anúncios duplicados',
                  'Conteúdo obsceno desrespeitoso sem consentimento',
                  'Assédio, ódio direcionado ou violência visual',
                  'Infração de direitos autorais ou marca',
                  'Mídia com resolução falsa ou arquivos corrompidos'
                ].map((reason, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleReportSubmit(reason)}
                    className="w-full text-zinc-350 bg-zinc-900/50 hover:bg-zinc-850 border border-zinc-800 p-3 rounded-xl transition-all cursor-pointer hover:border-zinc-700 hover:text-white"
                  >
                    {reason}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notificação Floating de Copiar Link */}
      {shareToast && (
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 bg-zinc-950/95 border border-zinc-800 p-4 rounded-xl shadow-2xl flex flex-col items-center justify-center gap-2 text-center animate-scale-up z-20 backdrop-blur-md">
          <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 text-white mb-1">
            <Check className="w-5 h-5 text-zinc-300" />
          </div>
          <span className="text-xs font-bold text-white">Link copiado para a área de transferência!</span>
          <span className="text-[10px] text-zinc-500 max-w-[280px] break-all select-all block bg-[#09090b] p-1.5 rounded mt-1 font-mono">
            {`${window.location.origin}${window.location.pathname}?post=${post.id}`}
          </span>
        </div>
      )}

    </article>
  );
}
