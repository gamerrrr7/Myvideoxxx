/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Edit3, Grid, FileText, Check, AlertCircle, Sparkles, LogOut, Video, Image as ImageIcon } from 'lucide-react';
import { User, Post, getPostCountForUser, getAllPostsFromDB, saveUserToDB, updateAllPostsUserMetadataInDB } from '../db';

interface ProfileViewProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
  onLogout: () => void;
  onSelectPost: (post: Post) => void;
}

export default function ProfileView({ user, onUpdateUser, onLogout, onSelectPost }: ProfileViewProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState(user.bio || '');
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregar contagem e publicações deste usuário
  const loadUserContent = async () => {
    try {
      const count = await getPostCountForUser(user.id);
      setPostCount(count);

      const allPosts = await getAllPostsFromDB();
      const userPosts = allPosts.filter(p => p.userId === user.id);
      setPosts(userPosts);
    } catch (err) {
      console.error('Erro ao buscar dados do perfil:', err);
    }
  };

  useEffect(() => {
    loadUserContent();
    setBioText(user.bio || '');
  }, [user]);

  // Alterar foto de perfil a partir do dispositivo
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setError('A foto deve ter menos de 5MB.');
        return;
      }

      setLoading(true);
      setError(null);
      setSuccess(null);

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          if (event.target?.result) {
            const base64Pic = event.target.result as string;
            
            // 1. Atualizar registro do usuário
            const updatedUser = {
              ...user,
              profilePic: base64Pic
            };
            
            // Simulação de hash fictício para persistência
            const dbRef = await import('../db');
            const currentUserInDb = await dbRef.getUserById(user.id);
            const passwordHash = currentUserInDb?.passwordHash || '123456';

            await saveUserToDB({
              ...updatedUser,
              passwordHash
            });

            // 2. Retroatividades: Atualizar avatar em todos os posts anteriores do usuário
            await updateAllPostsUserMetadataInDB(user.id, user.username, base64Pic);

            // 3. Notificar pai
            onUpdateUser(updatedUser);
            setSuccess('Foto de perfil alterada com sucesso!');
            loadUserContent();
          }
        } catch (err: any) {
          setError('Erro ao salvar foto de perfil no banco de dados local.');
        } finally {
          setLoading(false);
        }
      };

      reader.readAsDataURL(file);
    }
  };

  // Alterar biografia do usuário
  const handleSaveBio = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const updatedUser = {
        ...user,
        bio: bioText.trim()
      };

      const dbRef = await import('../db');
      const currentUserInDb = await dbRef.getUserById(user.id);
      const passwordHash = currentUserInDb?.passwordHash || '123456';

      await saveUserToDB({
        ...updatedUser,
        passwordHash
      });

      onUpdateUser(updatedUser);
      setEditingBio(false);
      setSuccess('Biografia atualizada com sucesso!');
    } catch (err) {
      setError('Erro ao atualizar biografia.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 p-4 sm:p-6" id="profile_view_container">
      
      {/* Mensagens de feedback */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-200 p-3 rounded-xl text-sm flex items-center gap-2" id="profile_error">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-emerald-950/40 border border-emerald-800 text-emerald-200 p-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in" id="profile_success">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      {/* Cartão de Identidade do Perfil */}
      <section className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row gap-6 sm:gap-8 items-center backdrop-blur-md relative" id="profile_card">
        {/* Foto de Perfil Alterável */}
        <div className="relative group shrink-0">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-zinc-800 bg-zinc-950 overflow-hidden shadow-xl">
            {user.profilePic ? (
              <img src={user.profilePic} alt={user.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-rose-950/40 to-zinc-900 flex items-center justify-center text-rose-500 font-bold uppercase text-2xl sm:text-3xl">
                {user.username[0]}
              </div>
            )}
          </div>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="absolute bottom-0 right-0 p-2 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-full border-2 border-zinc-900 transition-all shadow-lg hover:scale-105 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            title="Alterar foto de perfil"
            id="change_avatar_btn"
          >
            <Camera className="w-4.5 h-4.5" />
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarChange}
            accept="image/*"
            className="hidden"
            id="profile_avatar_file_input"
          />
        </div>

        {/* Informações de Perfil */}
        <div className="flex-1 text-center sm:text-left space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-center sm:justify-start">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white">@{user.username}</h2>
            
            <div className="flex justify-center gap-3">
              <button
                onClick={onLogout}
                className="bg-zinc-800 hover:bg-zinc-700/80 text-zinc-300 text-xs font-semibold px-4 py-1.5 rounded-lg border border-zinc-700/50 transition-all active:scale-95 flex items-center gap-1.5"
                id="logout_btn"
              >
                <LogOut className="w-3.5 h-3.5" /> Sair
              </button>
            </div>
          </div>

          {/* Biografia Opcional */}
          <div className="bg-zinc-950/30 p-3.5 rounded-xl border border-zinc-800/40 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-wider block">Bio</span>
              {!editingBio ? (
                <button
                  onClick={() => setEditingBio(true)}
                  className="text-[10px] text-rose-500 hover:text-rose-400 font-bold flex items-center gap-1 transition-colors uppercase tracking-wider"
                  id="edit_bio_btn"
                >
                  <Edit3 className="w-3 h-3" /> Editar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingBio(false); setBioText(user.bio || ''); }}
                    className="text-[10px] text-zinc-500 font-bold hover:text-zinc-400 uppercase tracking-widest"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveBio}
                    disabled={loading}
                    className="text-[10px] text-emerald-400 font-bold hover:text-emerald-300 uppercase tracking-widest"
                    id="save_bio_btn"
                  >
                    Confirmar
                  </button>
                </div>
              )}
            </div>

            {!editingBio ? (
              <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                {user.bio ? user.bio : 'Nenhuma biografia informada ainda. Clique em Editar para se apresentar para o mundo.'}
              </p>
            ) : (
              <textarea
                value={bioText}
                onChange={(e) => setBioText(e.target.value)}
                maxLength={200}
                placeholder="Escreva algo sobre você (máx. 200 caracteres)..."
                rows={2}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-lg p-2 text-sm text-white outline-none transition-all placeholder:text-zinc-700 resize-none"
                id="profile_bio_textarea"
              />
            )}
          </div>

          {/* Estatística rápida */}
          <div className="flex justify-center sm:justify-start gap-4">
            <div className="bg-zinc-950/40 border border-zinc-800/40 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-zinc-400 text-xs font-semibold">
              <Grid className="w-3.5 h-3.5 text-rose-500" />
              <span>Publicações: <strong className="text-white font-extrabold">{postCount}</strong></span>
            </div>
          </div>
        </div>
      </section>

      {/* Grid de Conteúdo Próprio */}
      <section className="space-y-4" id="profile_posts_section">
        <h3 className="text-white font-extrabold text-base flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-rose-500" />
          Minhas Publicações
        </h3>

        {posts.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900/30 rounded-2xl border border-zinc-800/50 space-y-3" id="profile_empty_state">
            <FileText className="w-12 h-12 text-zinc-700 mx-auto" />
            <div className="space-y-1">
              <p className="text-zinc-300 font-bold text-sm">Nenhum conteúdo publicado por você ainda</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">Suas mídias publicadas aparecerão organizadas nesta galeria pessoal.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4" id="profile_posts_grid">
            {posts.map((post) => (
              <div
                key={post.id}
                onClick={() => onSelectPost(post)}
                className="relative aspect-square rounded-xl overflow-hidden bg-black border border-zinc-800 hover:border-rose-400 group cursor-pointer shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              >
                {post.type === 'video' ? (
                  <video
                    src={post.mediaData}
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={post.mediaData}
                    alt={post.caption || "Mídia"}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}

                {/* Overlays de Informação no Hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                  <div className="flex items-center gap-4 text-sm font-black">
                    <span className="flex items-center gap-1 text-rose-400">
                      ♥ {post.likes.length}
                    </span>
                    <span className="flex items-center gap-1 text-zinc-250">
                      ✉ {post.comments.length}
                    </span>
                  </div>
                  
                  {/* Tipo ícone flutuante */}
                  <div className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-sm p-1.5 rounded-lg border border-zinc-800 text-zinc-300">
                    {post.type === 'video' ? <Video className="w-3.5 h-3.5 text-rose-500" /> : <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
