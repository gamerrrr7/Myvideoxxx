/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Home, PlusSquare, User as UserIcon, LogIn, Compass, ShieldAlert, Sparkles, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { getAllPostsFromDB, findUserByEmail, User, Post } from './db';
import AuthModal from './components/AuthModal';
import UploadModal from './components/UploadModal';
import PostCard from './components/PostCard';
import ProfileView from './components/ProfileView';
import MediaViewer from './components/MediaViewer';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<'feed' | 'profile'>('feed');
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signup'>('login');
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Visual deep link for single post shared (e.g. ?post=post_123456)
  const [highlightedPost, setHighlightedPost] = useState<Post | null>(null);

  // Media Viewer Lighbox State
  const [selectedMediaPost, setSelectedMediaPost] = useState<Post | null>(null);

  // Carregar sessão existente do localStorage ao iniciar
  useEffect(() => {
    const storedUser = localStorage.getItem('myvideoxxx_session');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        // Validar no banco se o usuário ainda existe
        findUserByEmail(parsed.email).then((userInDb) => {
          if (userInDb) {
            setCurrentUser({
              id: userInDb.id,
              username: userInDb.username,
              email: userInDb.email,
              bio: userInDb.bio,
              profilePic: userInDb.profilePic,
              createdAt: userInDb.createdAt
            });
          } else {
            localStorage.removeItem('myvideoxxx_session');
          }
        });
      } catch (e) {
        localStorage.removeItem('myvideoxxx_session');
      }
    }
  }, []);

  // Carregar todas as publicações do IndexedDB
  const fetchPosts = async () => {
    setLoading(true);
    try {
      const data = await getAllPostsFromDB();
      setPosts(data);

      // Tratar deep share link (?post=id) se houver
      const params = new URLSearchParams(window.location.search);
      const postId = params.get('post');
      if (postId) {
        const shared = data.find(p => p.id === postId);
        if (shared) {
          setHighlightedPost(shared);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('myvideoxxx_session', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('myvideoxxx_session');
    setActiveTab('feed');
  };

  const handleProfileUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('myvideoxxx_session', JSON.stringify(updatedUser));
    // Recarregar os posts para atualizar avatars no feed principal
    fetchPosts();
  };

  const handleTriggerAuth = (tab: 'login' | 'signup' = 'login') => {
    setAuthModalTab(tab);
    setShowAuthModal(true);
  };

  // Limpar overlay de post compartilhado
  const clearDeepLink = () => {
    setHighlightedPost(null);
    // Limpar o query param da url sem recarregar a página
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-[#fafafa] flex flex-col font-sans selection:bg-rose-500 selection:text-white" id="app_root">
      
      {/* 1. TOPO DA PÁGINA (NAVBAR) - SLEEK THEME */}
      <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-zinc-805 bg-[#09090b] sticky top-0 z-40" id="app_header">
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-4">
          
          {/* Logo do MyVideoXXX com o círculo vermelho e play do design */}
          <div 
            className="flex items-center gap-2 cursor-pointer select-none active:scale-98 transition-transform shrink-0" 
            onClick={() => { setActiveTab('feed'); clearDeepLink(); }}
            id="brand_logo_main"
          >
            <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-950/40">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white font-display">
              MyVideo<span className="text-red-500">XXX</span>
            </span>
          </div>

          {/* Pesquisa elegante do design para desktop */}
          <div className="hidden sm:block flex-1 max-w-md mx-6 lg:mx-12">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Pesquisar vídeos e criadores..." 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-1.5 px-9 text-xs text-white focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition-all placeholder:text-zinc-600"
              />
              <svg className="absolute left-3 top-2.5 text-zinc-500" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
          </div>

          {/* Menus / Ações do usuário */}
          <div className="flex items-center gap-4 shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-full transition-all active:scale-95 shadow"
                >
                  <PlusSquare className="w-3.5 h-3.5" /> Publicar
                </button>

                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex items-center gap-2 text-xs font-semibold py-1 px-2.5 rounded-lg transition-all ${activeTab === 'profile' ? 'text-rose-500 bg-rose-950/20' : 'text-zinc-400 hover:text-zinc-200'}`}
                  id="desktop_nav_profile"
                >
                  <div className="w-6 h-6 rounded-full border border-zinc-700 bg-zinc-800 overflow-hidden shrink-0">
                    {currentUser.profilePic ? (
                      <img src={currentUser.profilePic} alt={currentUser.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-rose-950/30 flex items-center justify-center text-rose-500 font-bold uppercase text-[9px]">
                        {currentUser.username[0]}
                      </div>
                    )}
                  </div>
                  <span className="hidden md:inline">@{currentUser.username}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleTriggerAuth('login')}
                  className="text-sm font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  id="desktop_nav_login"
                >
                  Entrar
                </button>
                <button
                  onClick={() => handleTriggerAuth('signup')}
                  className="bg-white text-black px-4 py-1.5 rounded-full text-xs font-bold hover:bg-zinc-200 transition-all shadow-lg shadow-white/5 cursor-pointer"
                  id="desktop_nav_signup"
                >
                  Criar conta
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* 2. LAYOUT EM 3 COLUNAS DO SLEEK INTERFACE */}
      <div className="flex-1 flex overflow-hidden w-full max-w-7xl mx-auto" id="app_sleek_layout">
        
        {/* ASIDE ESQUERDA (Navegação minimalista) */}
        <aside className="hidden lg:flex w-60 border-r border-zinc-800 p-4 flex-col gap-6 shrink-0" id="left_sidebar">
          <nav className="space-y-1">
            <button
              onClick={() => { setActiveTab('feed'); clearDeepLink(); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${activeTab === 'feed' && !highlightedPost ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-white'}`}
            >
              <svg className={activeTab === 'feed' && !highlightedPost ? 'text-red-500' : 'text-zinc-400'} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              Início
            </button>

            <button
              onClick={() => { setActiveTab('feed'); clearDeepLink(); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-zinc-400 hover:bg-zinc-900/60 hover:text-white rounded-lg transition-all text-sm font-medium cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
              Explorar
            </button>

            <button
              onClick={() => { setActiveTab('feed'); clearDeepLink(); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-zinc-400 hover:bg-zinc-900/60 hover:text-white rounded-lg transition-all text-sm font-medium cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
              Seguindo
            </button>
          </nav>

          <div className="pt-4 border-t border-zinc-800">
            <p className="px-3 text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-3">Minha Conta</p>
            
            <button
              onClick={() => {
                if (currentUser) {
                  setActiveTab('profile');
                } else {
                  handleTriggerAuth('login');
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all cursor-pointer ${activeTab === 'profile' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-white'}`}
            >
              <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                {currentUser?.profilePic ? (
                  <img src={currentUser.profilePic} alt={currentUser.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-rose-950/20 flex items-center justify-center text-[9px] text-rose-500 font-bold uppercase">
                    {currentUser ? currentUser.username[0] : '?'}
                  </div>
                )}
              </div>
              Meu Perfil
            </button>

            <button
              onClick={() => {
                if (currentUser) {
                  setShowUploadModal(true);
                } else {
                  handleTriggerAuth('login');
                }
              }}
              className="w-full text-left flex items-center gap-3 px-3 py-2 text-zinc-400 hover:bg-zinc-900/60 hover:text-white rounded-lg transition-all text-sm font-medium cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2500/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Enviar Mídia
            </button>
          </div>

          {!currentUser && (
            <div className="mt-auto p-4 rounded-2xl bg-gradient-to-br from-zinc-800/20 to-zinc-900/20 border border-zinc-850/60">
              <p className="text-xs text-zinc-400 mb-2 leading-relaxed">Faça login para colocar curtidas e comentar em vídeos legítimos.</p>
              <button 
                onClick={() => handleTriggerAuth('login')}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                Saber mais
              </button>
            </div>
          )}
        </aside>

        {/* CONTAINER CENTRAL (FEED E PERFIL) */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:py-8 custom-scrollbar h-[calc(100vh-64px)] pb-24 sm:pb-8" id="app_main">
          
          {/* Visualizador de Post Compartilhado / Detalhado */}
          {highlightedPost && (
            <div className="mb-8 p-4 bg-zinc-900/35 border border-zinc-800 rounded-2xl animate-scale-up space-y-4" id="deep_link_highlight">
              <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-red-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-red-650 rounded-full animate-ping" />
                  Publicação Compartilhada
                </span>
                <button
                  onClick={clearDeepLink}
                  className="text-xs bg-zinc-800 hover:bg-zinc-750 text-zinc-300 px-3 py-1 rounded-lg border border-zinc-700 transition cursor-pointer"
                >
                  Ver Feed Completo
                </button>
              </div>
              <PostCard 
                post={highlightedPost} 
                currentUser={currentUser} 
                onPostUpdate={fetchPosts} 
                onRequestAuth={() => handleTriggerAuth('login')}
                onSelectMedia={(post) => setSelectedMediaPost(post)}
              />
            </div>
          )}

          {/* FEED GERAL */}
          {activeTab === 'feed' && !highlightedPost && (
            <div className="space-y-6" id="feed_tab_content">
              
              {/* Header do Feed com Botão de Atualizar */}
              <div className="flex items-center justify-between mb-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white font-display flex items-center gap-2">
                  <Compass className="w-5 h-5 text-red-550" />
                  Destaques Recentes
                </h1>
                
                <button
                  onClick={fetchPosts}
                  disabled={loading}
                  className="p-1.5 justify-center bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all disabled:opacity-40 flex items-center gap-2 text-xs cursor-pointer"
                  title="Recarregar Feed"
                  id="refresh_feed_btn"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Atualizar</span>
                </button>
              </div>

              {/* Empty State de Início */}
              {posts.length === 0 ? (
                <div 
                  className="py-16 sm:py-20 text-center rounded-2xl bg-zinc-900/30 border border-zinc-800/50 px-4 sm:px-6 relative overflow-hidden flex flex-col justify-center items-center" 
                  id="feed_empty_state"
                >
                  {/* Ícone estilizado do rolo de filme do design original */}
                  <div className="relative mx-auto w-20 h-20 flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 mb-6">
                    <svg className="text-zinc-700" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                      <line x1="7" y1="2" x2="7" y2="22"/>
                      <line x1="17" y1="2" x2="17" y2="22"/>
                      <line x1="2" y1="12" x2="22" y2="12"/>
                      <line x1="2" y1="7" x2="7" y2="7"/>
                      <line x1="2" y1="17" x2="7" y2="17"/>
                      <line x1="17" y1="17" x2="22" y2="17"/>
                      <line x1="17" y1="7" x2="22" y2="7"/>
                    </svg>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-zinc-800 border-4 border-[#09090b] rounded-full flex items-center justify-center text-zinc-500 font-bold text-xs">?</div>
                  </div>

                  <div className="max-w-md mx-auto space-y-4">
                    <h2 className="text-white font-extrabold text-xl sm:text-2xl font-display">
                      Nenhum conteúdo publicado ainda
                    </h2>
                    <p className="text-zinc-500 text-xs sm:text-sm leading-relaxed">
                      Parece que o feed está vazio. Comece a criar uma conta rapidamente ou seja o primeiro a publicar um vídeo ou imagem legítima para a comunidade.
                    </p>
                    
                    <div className="pt-4 flex flex-col sm:flex-row gap-3 items-center justify-center">
                      {currentUser ? (
                        <button
                          onClick={() => setShowUploadModal(true)}
                          className="w-full sm:w-auto bg-white text-black hover:bg-zinc-200 font-bold text-sm px-6 py-2.5 rounded-full transition-all shadow-lg active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                          id="empty_state_upload_btn"
                        >
                          <PlusSquare className="w-4 h-4" /> Criar Publicação
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleTriggerAuth('signup')}
                            className="w-full sm:w-auto bg-white text-black hover:bg-zinc-200 font-bold text-sm px-6 py-2.5 rounded-full transition-all shadow-lg active:scale-98 cursor-pointer"
                            id="empty_state_signup_btn"
                          >
                            Criar conta
                          </button>
                          <button
                            onClick={() => handleTriggerAuth('login')}
                            className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-bold px-6 py-2.5 rounded-full border border-zinc-850 transition-all active:scale-97 cursor-pointer"
                            id="empty_state_login_btn"
                          >
                            Ver Tendências
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Lista de Posts Ativos */
                <div className="space-y-6" id="publications_feed_container">
                  {posts.map((post) => (
                    <PostCard 
                      key={post.id} 
                      post={post} 
                      currentUser={currentUser} 
                      onPostUpdate={fetchPosts} 
                      onRequestAuth={() => handleTriggerAuth('login')}
                      onSelectMedia={(post) => setSelectedMediaPost(post)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PERFIL */}
          {activeTab === 'profile' && (
            <div id="profile_tab_content">
              {currentUser ? (
                <ProfileView 
                  user={currentUser} 
                  onUpdateUser={handleProfileUpdate} 
                  onLogout={handleLogout}
                  onSelectPost={(post) => {
                    setSelectedMediaPost(post);
                  }}
                />
              ) : (
                /* Profile Login Required alert */
                <div className="py-20 text-center max-w-md mx-auto space-y-6" id="profile_fallback_container">
                  <div className="w-16 h-16 bg-rose-950/20 border border-rose-900/40 text-rose-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-white font-extrabold text-xl font-display">Acesso Restrito ao Perfil</h2>
                    <p className="text-zinc-500 text-xs sm:text-sm leading-relaxed">
                      Conecte-se com sua conta de acesso local para gerenciar suas mídias publicadas, biografia e foto de avatar do computador ou celular.
                  </p>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => handleTriggerAuth('login')}
                      className="bg-white text-black px-6 py-2 rounded-full text-xs font-bold hover:bg-zinc-200 transition-all cursor-pointer"
                    >
                      Fazer Login
                    </button>
                    <button
                      onClick={() => handleTriggerAuth('signup')}
                      className="bg-zinc-800 text-zinc-300 px-6 py-2 rounded-full text-xs font-semibold hover:bg-zinc-700 transition-all border border-zinc-700/60 cursor-pointer"
                    >
                      Registrar Conta
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* ASIDE DIREITA (Criadores e Caixa de Recuperação Segura do Design) */}
        <aside className="hidden xl:flex w-[300px] border-l border-zinc-800 p-6 flex-col gap-6 bg-[#09090b] shrink-0" id="right_sidebar">
          <div>
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-red-600 rounded-full"></span>
              Criadores Sugeridos
            </h3>
            <p className="text-xs text-zinc-500 italic bg-zinc-900/20 border border-zinc-850 p-4 rounded-xl">
              Nenhum criador para mostrar no momento.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-dashed border-zinc-800">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Recuperação</h3>
            <p className="text-xs text-zinc-600 mb-3 leading-relaxed">
              Esqueceu sua senha? Podemos ajudar você a reaver sua senha de acesso a partir do seu e-mail cadastrado ou redefini-la localmente.
            </p>
            <button 
              onClick={() => handleTriggerAuth('login')}
              className="text-[11px] font-bold text-zinc-400 hover:text-white underline decoration-zinc-700 cursor-pointer"
            >
              Recuperar Senha por E-mail
            </button>
          </div>

          <div className="mt-auto flex flex-wrap gap-x-3 gap-y-2 text-[10px] text-zinc-600 font-semibold">
            <span>Sobre</span>
            <span>Diretrizes</span>
            <span>Termos</span>
            <span>Privacidade</span>
            <span>&copy; {new Date().getFullYear()} MyVideoXXX</span>
          </div>
        </aside>

      </div>

      {/* 3. BARRA DE NAVEGAÇÃO MÓVEL (BOTTOM BAR) */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 p-2.5 flex items-center justify-around z-40 shadow-xl" id="bottom_navbar">
        <button
          onClick={() => { setActiveTab('feed'); clearDeepLink(); }}
          className={`flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'feed' && !highlightedPost ? 'text-rose-500' : 'text-zinc-550 hover:text-zinc-300'}`}
          id="mobile_bottom_nav_feed"
        >
          <Home className="w-5.5 h-5.5" />
          <span className="text-[9px] font-semibold tracking-wide block leading-none">Feed</span>
        </button>

        <button
          onClick={() => {
            if (currentUser) {
              setShowUploadModal(true);
            } else {
              handleTriggerAuth('login');
            }
          }}
          className="flex flex-col items-center justify-center gap-1 text-zinc-550"
          id="mobile_bottom_nav_upload"
        >
          <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white shadow-md active:scale-90 transition-transform -translate-y-1.5 shadow-red-950/40">
            <PlusSquare className="w-5 h-5 text-white" />
          </div>
          <span className="text-[9px] font-semibold tracking-wide block leading-none -mt-2">Postar</span>
        </button>

        <button
          onClick={() => {
            if (currentUser) {
              setActiveTab('profile');
            } else {
              handleTriggerAuth('login');
            }
          }}
          className={`flex flex-col items-center justify-center gap-1 transition-all ${activeTab === 'profile' ? 'text-rose-500' : 'text-zinc-550 hover:text-zinc-300'}`}
          id="mobile_bottom_nav_profile"
        >
          <UserIcon className="w-5.5 h-5.5" />
          <span className="text-[9px] font-semibold tracking-wide block leading-none">Perfil</span>
        </button>
      </nav>

      {/* 4. MODALS */}
      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        initialTab={authModalTab}
      />

      <UploadModal 
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        currentUser={currentUser}
        onUploadSuccess={fetchPosts}
        onRequestAuth={() => handleTriggerAuth('login')}
      />

      <MediaViewer 
        post={selectedMediaPost}
        isOpen={!!selectedMediaPost}
        onClose={() => setSelectedMediaPost(null)}
      />

    </div>
  );
}
