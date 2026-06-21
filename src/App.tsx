/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Home, PlusSquare, User as UserIcon, LogIn, Compass, ShieldAlert, Sparkles, AlertCircle, RefreshCw, Bell, Search, Hash, Check, X, ArrowRight, UserCheck, UserPlus, FileText } from 'lucide-react';
import { getAllPostsFromDB, findUserByEmail, User, Post, getNotificationsForUser, markNotificationsAsRead, getSuggestedUsers, AppNotification, followUserInDB, unfollowUserInDB } from './db';
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
  
  // Modals e Menus
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'signup'>('login');
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Visual deep link for single post shared (e.g. ?post=post_123456)
  const [highlightedPost, setHighlightedPost] = useState<Post | null>(null);

  // Media Viewer Lighbox State
  const [selectedMediaPost, setSelectedMediaPost] = useState<Post | null>(null);

  // REDE SOCIAL & BUSCA & NOTIFICAÇÕES
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [suggestedCreators, setSuggestedCreators] = useState<User[]>([]);
  const [trendingTags, setTrendingTags] = useState<{ tag: string; count: number }[]>([]);
  
  // Custom navigation
  const [selectedUserIdForProfile, setSelectedUserIdForProfile] = useState<string | null>(null);
  const [selectedUserRecord, setSelectedUserRecord] = useState<User | null>(null);
  const [activeFeedFilter, setActiveFeedFilter] = useState<'explorar' | 'seguindo'>('explorar');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Carregar notificações do usuário logado
  const loadNotifications = async (userId: string) => {
    try {
      const list = await getNotificationsForUser(userId);
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.isRead).length);
    } catch (err) {
      console.error('Erro ao ler notificações:', err);
    }
  };

  // Carregar sugestões de perfis e tags de hashtags populares
  const loadSuggestedAndTrends = async (allPosts: Post[]) => {
    try {
      const list = await getSuggestedUsers(currentUser ? currentUser.id : null);
      setSuggestedCreators(list);

      // Calcular tendências baseados no Caption das publicações
      const tagCountMap: Record<string, number> = {};
      allPosts.forEach(post => {
        if (post.tags && post.tags.length > 0) {
          post.tags.forEach(t => {
            tagCountMap[t] = (tagCountMap[t] || 0) + 1;
          });
        } else {
          // Fallback parsing regex
          const matches = post.caption.match(/#([a-zA-Z0-9_À-ÿ]+)/g);
          if (matches) {
            matches.forEach(m => {
              const low = m.toLowerCase();
              tagCountMap[low] = (tagCountMap[low] || 0) + 1;
            });
          }
        }
      });

      const sortedTags = Object.entries(tagCountMap)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setTrendingTags(sortedTags);
    } catch (err) {
      console.error('Erro em tendências / sugestões:', err);
    }
  };

  // Carregar sessão existente do localStorage ao iniciar
  useEffect(() => {
    const storedUser = localStorage.getItem('myvideoxxx_session');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        // Validar no banco se o usuário ainda existe
        findUserByEmail(parsed.email).then((userInDb) => {
          if (userInDb) {
            const freshUser = {
              id: userInDb.id,
              username: userInDb.username,
              email: userInDb.email,
              bio: userInDb.bio,
              profilePic: userInDb.profilePic,
              createdAt: userInDb.createdAt,
              followers: userInDb.followers || [],
              following: userInDb.following || []
            };
            setCurrentUser(freshUser);
            loadNotifications(userInDb.id);
          } else {
            localStorage.removeItem('myvideoxxx_session');
          }
        });
      } catch (e) {
        localStorage.removeItem('myvideoxxx_session');
      }
    }
  }, []);

  // Periódico pooling suave para novas notificações em segundo plano (real-time experience)
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      loadNotifications(currentUser.id);
    }, 8000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Carregar todas as publicações do IndexedDB
  const fetchPosts = async () => {
    setLoading(true);
    try {
      const data = await getAllPostsFromDB();
      // Filtrar posts ativos (remover spam denúncias abusivas para moderação simples)
      setPosts(data);

      loadSuggestedAndTrends(data);

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
  }, [currentUser]);

  // Busca e sugestões em tempo real as-you-type
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchSuggestions([]);
      return;
    }

    const q = searchQuery.toLowerCase().trim();
    const cleanQ = q.startsWith('#') ? q.substring(1) : q;

    const querySuggestions = async () => {
      try {
        const dbRef = await import('./db');
        const allUsers = await dbRef.getAllUsersFromDB();
        
        // Match usuários
        const matchUsers = allUsers.filter(u => u.username.toLowerCase().includes(q))
          .map(u => ({
            type: 'user' as const,
            id: u.id,
            title: `@${u.username}`,
            detail: u.bio || 'Ver perfil do criador',
            image: u.profilePic
          }));

        // Match hashtags populares
        const matchTags = trendingTags.filter(t => t.tag.toLowerCase().includes(cleanQ))
          .map(t => ({
            type: 'tag' as const,
            id: t.tag,
            title: t.tag,
            detail: `${t.count} publicações`
          }));

        // Match posts por legenda
        const matchPosts = posts.filter(p => p.caption.toLowerCase().includes(q))
          .map(p => ({
            type: 'post' as const,
            id: p.id,
            title: p.caption,
            detail: `Mídia de @${p.username}`,
            image: p.mediaData,
            record: p
          }));

        setSearchSuggestions([...matchUsers, ...matchTags, ...matchPosts].slice(0, 8));
      } catch (err) {
        console.error(err);
      }
    };

    const timeout = setTimeout(querySuggestions, 150);
    return () => clearTimeout(timeout);
  }, [searchQuery, posts, trendingTags]);

  // Fechar dropdown de sugestões ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('myvideoxxx_session', JSON.stringify(user));
    loadNotifications(user.id);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setNotifications([]);
    setUnreadCount(0);
    localStorage.removeItem('myvideoxxx_session');
    setActiveTab('feed');
    setSelectedUserIdForProfile(null);
    setSelectedUserRecord(null);
  };

  const handleProfileUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('myvideoxxx_session', JSON.stringify(updatedUser));
    fetchPosts();
  };

  const handleTriggerAuth = (tab: 'login' | 'signup' = 'login') => {
    setAuthModalTab(tab);
    setShowAuthModal(true);
  };

  // Limpar overlay de post compartilhado
  const clearDeepLink = () => {
    setHighlightedPost(null);
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  // Navegar para o perfil de um usuário clicado
  const handleSelectUser = async (userId: string) => {
    try {
      const dbRef = await import('./db');
      const usrInDb = await dbRef.getUserById(userId);
      if (usrInDb) {
        const { passwordHash, ...safeUser } = usrInDb;
        setSelectedUserIdForProfile(userId);
        setSelectedUserRecord(safeUser);
        setActiveTab('profile');
        clearDeepLink();
      }
    } catch (err) {
      console.error('Erro ao abrir perfil do usuário:', err);
    }
  };

  const handleViewOwnProfile = () => {
    if (currentUser) {
      setSelectedUserIdForProfile(currentUser.id);
      setSelectedUserRecord(currentUser);
      setActiveTab('profile');
      clearDeepLink();
    } else {
      handleTriggerAuth('login');
    }
  };

  // Abrir barra/dropdown de notificações e marcar lidas instantaneamente
  const handleToggleNotifications = async () => {
    if (!currentUser) {
      handleTriggerAuth('login');
      return;
    }
    const targetState = !showNotifDropdown;
    setShowNotifDropdown(targetState);
    if (targetState) {
      try {
        await markNotificationsAsRead(currentUser.id);
        setUnreadCount(0);
        loadNotifications(currentUser.id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSelectSuggestion = (sug: any) => {
    setShowSearchSuggestions(false);
    if (sug.type === 'user') {
      handleSelectUser(sug.id);
      setSearchQuery('');
    } else if (sug.type === 'tag') {
      setActiveTagFilter(sug.id);
      setActiveTab('feed');
      clearDeepLink();
      setSearchQuery('');
    } else if (sug.type === 'post') {
      setSelectedMediaPost(sug.record);
      setSearchQuery('');
    }
  };

  const handleFollowSuggested = async (targetId: string, username: string) => {
    if (!currentUser) {
      handleTriggerAuth('login');
      return;
    }
    try {
      await followUserInDB(currentUser.id, targetId);
      // Recarregar sessões e estatísticas
      const dbRef = await import('./db');
      const updatedUser = await dbRef.getUserById(currentUser.id);
      if (updatedUser) {
        setCurrentUser(updatedUser);
        localStorage.setItem('myvideoxxx_session', JSON.stringify(updatedUser));
      }
      fetchPosts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnfollowSuggested = async (targetId: string, username: string) => {
    if (!currentUser) {
      handleTriggerAuth('login');
      return;
    }
    try {
      await unfollowUserInDB(currentUser.id, targetId);
      const dbRef = await import('./db');
      const updatedUser = await dbRef.getUserById(currentUser.id);
      if (updatedUser) {
        setCurrentUser(updatedUser);
        localStorage.setItem('myvideoxxx_session', JSON.stringify(updatedUser));
      }
      fetchPosts();
    } catch (err) {
      console.error(err);
    }
  };

  // Retorna os posts filtrados por busca, hashtag ou feed "seguindo"
  const getFilteredPosts = () => {
    let list = [...posts];

    // Remover spam blurs do feed inicial para higiene visual básica
    list = list.filter(p => !p.isFlaggedSpam);

    // Filtragem de busca global por termo (em Caption, tags ou nick)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => 
        p.caption.toLowerCase().includes(q) || 
        p.username.toLowerCase().includes(q) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    // Filtragem por hashtag clicada
    if (activeTagFilter) {
      const cleanTag = activeTagFilter.toLowerCase();
      list = list.filter(p => {
        if (p.tags && p.tags.length > 0) return p.tags.includes(cleanTag);
        return p.caption.toLowerCase().includes(cleanTag);
      });
    }

    // Feed "Seguindo" de criadores que eu sigo síncronos
    if (activeFeedFilter === 'seguindo') {
      if (currentUser) {
        const followingIds = currentUser.following || [];
        list = list.filter(p => followingIds.includes(p.userId));
      } else {
        return []; // vazio se não logado
      }
    }

    return list;
  };

  const filteredPostsList = getFilteredPosts();

  return (
    <div className="min-h-screen bg-[#070708] text-[#fafafa] flex flex-col font-sans selection:bg-rose-600 selection:text-white" id="app_root">
      
      {/* 1. TOPO DA PÁGINA (NAVBAR) */}
      <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-zinc-900 bg-[#0c0c0e] sticky top-0 z-40" id="app_header">
        <div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-4">
          
          {/* Logo do MyVideoXXX */}
          <div 
            className="flex items-center gap-2 cursor-pointer select-none active:scale-98 transition-transform shrink-0" 
            onClick={() => { setActiveTab('feed'); clearDeepLink(); setActiveTagFilter(null); setActiveFeedFilter('explorar'); }}
            id="brand_logo_main"
          >
            <div className="w-8.5 h-8.5 bg-gradient-to-br from-red-600 to-rose-700 rounded-xl flex items-center justify-center shadow-lg shadow-red-950/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white font-display">
              MyVideo<span className="text-red-500 font-black">XXX</span>
            </span>
          </div>

          {/* Pesquisa elegante com live suggestions dropdown */}
          <div className="flex-1 max-w-md mx-4 relative" ref={searchContainerRef}>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Pesquisar vídeos, #tags ou @criadores..." 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchSuggestions(true);
                }}
                onFocus={() => setShowSearchSuggestions(true)}
                className="w-full bg-[#121215] border border-zinc-800 rounded-full py-2 px-9 text-xs text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all placeholder:text-zinc-650"
              />
              <Search className="absolute left-3.5 top-2.5 w-3.5 h-3.5 text-zinc-550" />
              {searchQuery && (
                <button 
                  onClick={() => { setSearchQuery(''); setSearchSuggestions([]); }} 
                  className="absolute right-3.5 top-2.5 text-zinc-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdown de sugestão as-you-type */}
            {showSearchSuggestions && searchSuggestions.length > 0 && (
              <div className="absolute top-11 inset-x-0 bg-[#0e0e11] border border-zinc-800 rounded-2xl shadow-2xl p-2.5 space-y-1 z-50 animate-scale-up max-h-96 overflow-y-auto custom-scrollbar">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest px-2.5 py-1">Sugestões rápidas</p>
                {searchSuggestions.map((sug, i) => (
                  <div
                    key={i}
                    onClick={() => handleSelectSuggestion(sug)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-900/80 cursor-pointer transition-colors border border-transparent hover:border-zinc-800/40"
                  >
                    {sug.type === 'user' ? (
                      <div className="w-8 h-8 rounded-full border border-zinc-800 bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold text-rose-500">
                        {sug.image ? <img src={sug.image} alt={sug.title} className="w-full h-full object-cover" /> : (sug.title[1]?.toUpperCase() || 'U')}
                      </div>
                    ) : sug.type === 'tag' ? (
                      <div className="w-8 h-8 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-center text-rose-500">
                        <Hash className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-850 overflow-hidden shrink-0">
                        {sug.record.type === 'video' ? (
                          <div className="w-full h-full relative flex items-center justify-center bg-black/80">
                            <svg className="w-3 h-3 text-rose-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        ) : (
                          <img src={sug.image} alt="post" className="w-full h-full object-cover" />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{sug.title}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{sug.detail}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-650 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Menus / Notificações / Ações */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0 relative">
            {currentUser ? (
              <div className="flex items-center gap-2 sm:gap-3.5">
                {/* Botão de Notificação */}
                <div className="relative">
                  <button
                    onClick={handleToggleNotifications}
                    className={`p-2 rounded-full border transition-all text-zinc-450 hover:text-white cursor-pointer relative ${showNotifDropdown ? 'bg-zinc-900 border-zinc-800' : 'bg-transparent border-transparent'}`}
                    title="Notificações legítimas"
                    id="notif_bell_btn"
                  >
                    <Bell className="w-4.5 h-4.5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 rounded-full bg-rose-600 text-[8px] font-black text-white flex items-center justify-center px-1 border border-zinc-950 animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Dropdown de Notificações */}
                  {showNotifDropdown && (
                    <div className="absolute right-0 top-11 bg-[#0c0c0e] border border-zinc-850 rounded-2xl shadow-2xl p-3.5 w-76 sm:w-85 z-50 animate-scale-up space-y-3" id="notif_dropdown">
                      <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                        <span className="text-xs font-extrabold text-white">Central de Alertas</span>
                        <span className="text-[10px] bg-rose-955 text-rose-455 font-bold px-2 py-0.5 rounded-full">Notificações</span>
                      </div>

                      <div className="max-h-72 overflow-y-auto space-y-2 custom-scrollbar">
                        {notifications.length === 0 ? (
                          <div className="py-8 text-center text-zinc-600 text-xs italic">
                            Nenhuma notificação por enquanto.
                          </div>
                        ) : (
                          notifications.map((noti) => (
                            <div 
                              key={noti.id} 
                              onClick={() => {
                                setShowNotifDropdown(false);
                                if (noti.postId) {
                                  const searchSharedPost = posts.find(p => p.id === noti.postId);
                                  if (searchSharedPost) {
                                    setSelectedMediaPost(searchSharedPost);
                                  }
                                } else {
                                  handleSelectUser(noti.senderId);
                                }
                              }}
                              className="flex gap-2.5 items-start p-2 rounded-xl bg-zinc-950/40 border border-zinc-900/60 hover:bg-zinc-900/60 cursor-pointer transition-colors"
                            >
                              <div className="w-8 h-8 rounded-full bg-zinc-855 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center text-[10px] text-zinc-400 font-bold uppercase">
                                {noti.senderProfilePic ? <img src={noti.senderProfilePic} alt={noti.senderName} className="w-full h-full object-cover" /> : noti.senderName[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] text-zinc-300 leading-snug">
                                  <strong className="text-white">@{noti.senderName}</strong>{' '}
                                  {noti.type === 'follow' && 'começou a seguir você.'}
                                  {noti.type === 'like' && 'curtiu seu vídeo.'}
                                  {noti.type === 'comment' && 'comentou na sua publicação.'}
                                  {noti.type === 'reply' && 'respondeu ou comentou em um mesmo tópico.'}
                                </p>
                                <span className="text-[9px] text-zinc-500 font-medium">Agora mesmo</span>
                              </div>
                              {!noti.isRead && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 self-center" />}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowUploadModal(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-4 py-2 rounded-full transition-all active:scale-95 shadow cursor-pointer shadow-rose-950/20"
                >
                  <PlusSquare className="w-3.5 h-3.5" /> Publicar
                </button>

                <button
                  onClick={handleViewOwnProfile}
                  className={`flex items-center gap-2 text-xs font-semibold py-1 px-1.5 sm:px-2.5 rounded-xl transition-all border ${activeTab === 'profile' && selectedUserIdForProfile === currentUser.id ? 'text-rose-500 bg-rose-950/15 border-rose-900/20' : 'text-zinc-400 hover:text-zinc-200 border-transparent'}`}
                  id="desktop_nav_profile"
                >
                  <div className="w-6.5 h-6.5 rounded-full border border-zinc-800 bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center">
                    {currentUser.profilePic ? (
                      <img src={currentUser.profilePic} alt={currentUser.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-rose-95-0/32 flex items-center justify-center text-rose-550 font-bold uppercase text-[9px]">
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
                  className="text-xs sm:text-sm font-semibold text-zinc-455 hover:text-white transition-colors cursor-pointer"
                  id="desktop_nav_login"
                >
                  Entrar
                </button>
                <button
                  onClick={() => handleTriggerAuth('signup')}
                  className="bg-white text-black px-4 py-1.5 rounded-full text-xs font-black hover:bg-zinc-200 transition-all shadow-lg shadow-white/5 cursor-pointer"
                  id="desktop_nav_signup"
                >
                  Criar conta
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* 2. LAYOUT EM 3 COLUNAS */}
      <div className="flex-1 flex overflow-hidden w-full max-w-7xl mx-auto" id="app_sleek_layout">
        
        {/* ASIDE ESQUERDA (Navegação social) */}
        <aside className="hidden lg:flex w-60 border-r border-[#121215] p-4 flex-col gap-6 shrink-0" id="left_sidebar">
          <nav className="space-y-1">
            <button
              onClick={() => { setActiveTab('feed'); clearDeepLink(); setActiveTagFilter(null); setActiveFeedFilter('explorar'); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'feed' && activeFeedFilter === 'explorar' && !activeTagFilter && !highlightedPost ? 'bg-[#121215] text-white border border-zinc-850' : 'text-zinc-400 hover:bg-[#121215]/50 hover:text-white'}`}
            >
              <Compass className={`w-4 h-4 ${activeTab === 'feed' && activeFeedFilter === 'explorar' && !activeTagFilter && !highlightedPost ? 'text-rose-500' : 'text-zinc-400'}`} />
              Início / Explorar
            </button>

            {currentUser && (
              <button
                onClick={() => { setActiveTab('feed'); clearDeepLink(); setActiveTagFilter(null); setActiveFeedFilter('seguindo'); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'feed' && activeFeedFilter === 'seguindo' && !activeTagFilter && !highlightedPost ? 'bg-[#121215] text-white border border-zinc-850' : 'text-zinc-400 hover:bg-[#121215]/50 hover:text-white'}`}
              >
                <UserCheck className={`w-4 h-4 ${activeTab === 'feed' && activeFeedFilter === 'seguindo' && !activeTagFilter ? 'text-rose-500' : 'text-zinc-400'}`} />
                Seguindo
              </button>
            )}

            <button
              onClick={handleViewOwnProfile}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTab === 'profile' && selectedUserIdForProfile === currentUser?.id ? 'bg-[#121215] text-white border border-zinc-850' : 'text-zinc-400 hover:bg-[#121215]/50 hover:text-white'}`}
            >
              <UserIcon className="w-4 h-4 text-zinc-400" />
              Meu Perfil
            </button>
          </nav>

          {/* TENDÊNCIAS DE TAGS POPULARES */}
          <div className="pt-4 border-t border-zinc-900 space-y-3">
            <p className="px-3 text-[10px] uppercase tracking-widest text-[#52525b] font-extrabold flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-rose-500" /> Hashtags Populares
            </p>
            
            {trendingTags.length === 0 ? (
              <p className="text-[10px] text-zinc-600 px-3 italic">Nenhuma hashtag gerada ainda.</p>
            ) : (
              <div className="space-y-1">
                {trendingTags.map((trend, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setActiveTagFilter(trend.tag);
                      setActiveTab('feed');
                      clearDeepLink();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${activeTagFilter === trend.tag ? 'text-rose-550 bg-rose-955/15 font-bold' : 'text-zinc-450 hover:bg-zinc-900/40 hover:text-zinc-150'}`}
                  >
                    <span className="truncate">{trend.tag}</span>
                    <span className="text-[9px] bg-zinc-900 text-zinc-550 px-1.5 py-0.5 rounded-md font-mono">{trend.count} v</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!currentUser && (
            <div className="mt-auto p-4 rounded-2xl bg-gradient-to-br from-[#121215] to-[#0c0c0e] border border-zinc-900">
              <p className="text-[11px] text-zinc-450 mb-3 leading-relaxed">Conecte-se hoje para seguir novos criadores e deixar seu like legítimo.</p>
              <button 
                onClick={() => handleTriggerAuth('login')}
                className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-rose-950/20"
              >
                Conectar Conta
              </button>
            </div>
          )}
        </aside>

        {/* CONTAINER CENTRAL (FEED E PERFIL) */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:py-8 custom-scrollbar h-[calc(100vh-64px)] pb-24 sm:pb-8 bg-zinc-950/20" id="app_main">
          
          {/* Tag Filtro Ativo Header Notification */}
          {activeTagFilter && (
            <div className="mb-6 p-3.5 bg-zinc-900/40 border border-rose-950/30 rounded-2xl flex items-center justify-between animate-slide-down">
              <div className="flex items-center gap-2 text-xs">
                <Hash className="w-4 h-4 text-rose-500" />
                <span className="text-zinc-400">Filtrando por hashtag:</span>
                <strong className="text-rose-400 font-extrabold">{activeTagFilter}</strong>
              </div>
              <button 
                onClick={() => setActiveTagFilter(null)} 
                className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Limpar hashtag"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Visualizador de Post Compartilhado / Detalhado */}
          {highlightedPost && (
            <div className="mb-8 p-4 bg-zinc-900/35 border border-zinc-900 rounded-2xl animate-scale-up space-y-4" id="deep_link_highlight">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-red-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-red-650 rounded-full animate-ping" />
                  Mídia compartilhada diretamente
                </span>
                <button
                  onClick={clearDeepLink}
                  className="text-xs bg-[#121215] hover:bg-zinc-900 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-805 transition cursor-pointer"
                >
                  Voltar para Feed Geral
                </button>
              </div>
              <PostCard 
                post={highlightedPost} 
                currentUser={currentUser} 
                onPostUpdate={fetchPosts} 
                onRequestAuth={() => handleTriggerAuth('login')}
                onSelectMedia={(post) => setSelectedMediaPost(post)}
                onSelectTag={(tag) => {
                  setActiveTagFilter(tag);
                  setActiveTab('feed');
                  clearDeepLink();
                }}
                onSelectUser={handleSelectUser}
              />
            </div>
          )}

          {/* FEED GERAL */}
          {activeTab === 'feed' && !highlightedPost && (
            <div className="space-y-6" id="feed_tab_content">
              
              {/* Header do Feed com Botão de Atualizar e Chaveador de Tab "Explorar/Seguindo" se logado */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-red-500" />
                  <h1 className="text-base sm:text-lg font-bold text-white font-display uppercase tracking-wider">
                    {activeFeedFilter === 'explorar' ? 'Explorar Conteúdo' : 'Alimentação Seguindo'}
                  </h1>
                </div>
                
                <button
                  onClick={fetchPosts}
                  disabled={loading}
                  className="p-1.5 justify-center bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all disabled:opacity-40 flex items-center gap-2 text-xs cursor-pointer"
                  title="Recarregar feed de mídias"
                  id="refresh_feed_btn"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline font-bold">Atualizar</span>
                </button>
              </div>

              {/* Chave de Tab móvel/desktop adicional */}
              {currentUser && (
                <div className="flex gap-2 border-b border-zinc-900 pb-2">
                  <button
                    onClick={() => { setActiveFeedFilter('explorar'); setActiveTagFilter(null); }}
                    className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all cursor-pointer ${activeFeedFilter === 'explorar' && !activeTagFilter ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Destaques Gerais
                  </button>
                  <button
                    onClick={() => { setActiveFeedFilter('seguindo'); setActiveTagFilter(null); }}
                    className={`text-xs font-semibold px-4 py-1.5 rounded-lg transition-all cursor-pointer ${activeFeedFilter === 'seguindo' && !activeTagFilter ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    Criadores Seguidos ({currentUser.following?.length || 0})
                  </button>
                </div>
              )}

              {/* Empty State do Feed */}
              {filteredPostsList.length === 0 ? (
                <div 
                  className="py-16 sm:py-20 text-center rounded-2xl bg-[#09090b]/55 border border-zinc-900 px-4 sm:px-6 relative overflow-hidden flex flex-col justify-center items-center" 
                  id="feed_empty_state"
                >
                  <div className="relative mx-auto w-20 h-20 flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 mb-6">
                    <svg className="text-zinc-700" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                      <line x1="7" y1="2" x2="7" y2="22"/>
                      <line x1="17" y1="2" x2="17" y2="22"/>
                      <line x1="2" y1="12" x2="22" y2="12"/>
                    </svg>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-zinc-800 border-4 border-[#070708] rounded-full flex items-center justify-center text-zinc-500 font-bold text-xs">?</div>
                  </div>

                  <div className="max-w-md mx-auto space-y-4">
                    <h2 className="text-white font-extrabold text-xl sm:text-2xl font-display">
                      Nenhum conteúdo publicado ainda
                    </h2>
                    <p className="text-zinc-500 text-xs sm:text-sm leading-relaxed">
                      Parece que não há resultados para o filtro de postagem selecionado atualmente. Publique fotos ou vídeos com hashtags como #games para engajar.
                    </p>
                    
                    <div className="pt-4 flex flex-col sm:flex-row gap-3 items-center justify-center">
                      {currentUser ? (
                         <button
                           onClick={() => setShowUploadModal(true)}
                           className="w-full sm:w-auto bg-white text-black hover:bg-zinc-200 font-bold text-sm px-6 py-2.5 rounded-full transition-all shadow-lg active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                         >
                           <PlusSquare className="w-4 h-4" /> Criar Publicação
                         </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleTriggerAuth('signup')}
                            className="w-full sm:w-auto bg-white text-black hover:bg-zinc-200 font-bold text-sm px-6 py-2.5 rounded-full transition-all shadow-lg active:scale-98 cursor-pointer animate-pulse"
                          >
                            Registrar-se Grátis
                          </button>
                          <button
                            onClick={() => handleTriggerAuth('login')}
                            className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-bold px-6 py-2.5 rounded-full border border-zinc-850 transition-all cursor-pointer"
                          >
                            Conectar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Lista de Posts Ativos */
                <div className="space-y-6" id="publications_feed_container">
                  {filteredPostsList.map((post) => (
                    <PostCard 
                      key={post.id} 
                      post={post} 
                      currentUser={currentUser} 
                      onPostUpdate={fetchPosts} 
                      onRequestAuth={() => handleTriggerAuth('login')}
                      onSelectMedia={(post) => setSelectedMediaPost(post)}
                      onSelectTag={(tag) => {
                        setActiveTagFilter(tag);
                        setActiveTab('feed');
                        clearDeepLink();
                      }}
                      onSelectUser={handleSelectUser}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PERFIL (Com suporte completo a outros usuários através do SPA router) */}
          {activeTab === 'profile' && (
            <div id="profile_tab_content" className="animate-fade-in">
              <ProfileView 
                user={selectedUserRecord || currentUser || {} as User} 
                currentUser={currentUser} 
                onUpdateUser={handleProfileUpdate} 
                onLogout={handleLogout}
                onRequestAuth={() => handleTriggerAuth('login')}
                onSelectUser={handleSelectUser}
                onSelectPost={(post) => {
                  setSelectedMediaPost(post);
                }}
              />
            </div>
          )}
        </main>

        {/* ASIDE DIREITA (Sugestão de Criadores e Recuperação de Conta) */}
        <aside className="hidden xl:flex w-[300px] border-l border-[#121215] p-6 flex-col gap-6 bg-[#0c0c0e] shrink-0" id="right_sidebar">
          
          {/* LISTA DEDICADA DE CRIADORES RECOMENDADOS */}
          <div>
            <h3 className="text-xs font-extrabold text-[#71717a] uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-3 bg-red-650 rounded-full" />
              Perfils Recomendados
            </h3>
            
            {suggestedCreators.length === 0 ? (
              <div className="text-center p-4 rounded-xl border border-zinc-900 bg-[#070708]/30">
                <p className="text-[11px] text-zinc-500 italic">Preencha as contas dos criadores populares para começar.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestedCreators.map(userSuggestion => {
                  const isFollowingSuggested = currentUser?.following?.includes(userSuggestion.id);
                  return (
                    <div 
                      key={userSuggestion.id} 
                      className="flex items-center justify-between p-2 rounded-xl bg-zinc-950/40 border border-[#121215] hover:border-zinc-850 transition-all duration-200"
                    >
                      <div 
                        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                        onClick={() => handleSelectUser(userSuggestion.id)}
                      >
                        <div className="w-8 h-8 rounded-full bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center border border-zinc-850">
                          {userSuggestion.profilePic ? (
                            <img src={userSuggestion.profilePic} alt={userSuggestion.username} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[11px] text-zinc-450 font-bold uppercase">{userSuggestion.username[0]}</span>
                          )}
                        </div>
                        <div className="min-w-0 truncate">
                          <p className="text-xs font-bold text-white truncate hover:underline">@{userSuggestion.username}</p>
                          <p className="text-[9px] text-zinc-500 truncate">{userSuggestion.bio || 'Ver criador legítimo'}</p>
                        </div>
                      </div>

                      {/* Botão seguir/unfollow síncrono rápido */}
                      {currentUser && currentUser.id !== userSuggestion.id && (
                        <button
                          onClick={() => {
                            if (isFollowingSuggested) {
                              handleUnfollowSuggested(userSuggestion.id, userSuggestion.username);
                            } else {
                              handleFollowSuggested(userSuggestion.id, userSuggestion.username);
                            }
                          }}
                          className={`text-[10px] font-bold px-3 py-1 rounded-full transition-all cursor-pointer ${
                            isFollowingSuggested
                              ? 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
                              : 'bg-rose-600 hover:bg-rose-500 text-white'
                          }`}
                        >
                          {isFollowingSuggested ? 'Seguindo' : 'Seguir'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CAIXA DE RECUPERAÇÃO SEGURA */}
          <div className="p-4 rounded-xl border border-dashed border-zinc-850 bg-zinc-950/20 backdrop-blur-md">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <span className="w-1 h-3.5 bg-blue-500 rounded" />
              Recuperação local
            </h3>
            <p className="text-[11px] text-zinc-550 mb-3 leading-relaxed">
              Esqueceu seus dados? Oferecemos um assistente local para reaver suas senhas ou enviar links de verificação diretamente para o navegador.
            </p>
            <button 
              onClick={() => handleTriggerAuth('login')}
              className="text-[11px] font-bold text-rose-500 hover:text-rose-450 hover:underline cursor-pointer flex items-center gap-0.5"
            >
              Recuperar Senha por E-mail →
            </button>
          </div>

          <div className="mt-auto flex flex-wrap gap-x-3 gap-y-2 text-[10px] text-zinc-600 font-semibold border-t border-zinc-900 pt-3">
            <span>Sobre</span>
            <span>Diretrizes</span>
            <span>Termos</span>
            <span>Privacidade</span>
            <span>&copy; {new Date().getFullYear()} MyVideoXXX</span>
          </div>
        </aside>

      </div>

      {/* 3. BARRA DE NAVEGAÇÃO MÓVEL (BOTTOM BAR) */}
      <nav className="sm:hidden fixed bottom-5 inset-x-4 bg-[#0a0a0c]/90 backdrop-blur-lg border border-zinc-800 p-2 rounded-2xl flex items-center justify-around z-40 shadow-2xl" id="bottom_navbar">
        <button
          onClick={() => { setActiveTab('feed'); clearDeepLink(); setActiveTagFilter(null); setActiveFeedFilter('explorar'); }}
          className={`flex flex-col items-center justify-center gap-1 transition-all p-1.5 rounded-xl ${activeTab === 'feed' && !activeTagFilter && !highlightedPost ? 'text-rose-500 bg-rose-955/10' : 'text-zinc-500 hover:text-zinc-300'}`}
          id="mobile_bottom_nav_feed"
        >
          <Home className="w-5 h-5" />
          <span className="text-[8.5px] font-bold tracking-wide block leading-none">Feed</span>
        </button>

        <button
          onClick={() => {
            if (currentUser) {
              setSearchQuery('');
              setActiveTagFilter(null);
              // abrir barra de pesquisa no mobile
              const element = document.querySelector('input[type="text"]') as HTMLInputElement;
              element?.focus();
            } else {
              handleTriggerAuth('login');
            }
          }}
          className="flex flex-col items-center justify-center gap-1 text-zinc-500 hover:text-zinc-300"
        >
          <Search className="w-5 h-5" />
          <span className="text-[8.5px] font-bold tracking-wide block leading-none">Busca</span>
        </button>

        <button
          onClick={() => {
            if (currentUser) {
              setShowUploadModal(true);
            } else {
              handleTriggerAuth('login');
            }
          }}
          className="flex flex-col items-center justify-center gap-1 text-zinc-500"
          id="mobile_bottom_nav_upload"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-r from-red-600 to-rose-600 flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform shadow-rose-950/30">
            <PlusSquare className="w-4.5 h-4.5 text-white" />
          </div>
        </button>

        <button
          onClick={handleToggleNotifications}
          className={`flex flex-col items-center justify-center gap-1 transition-all p-1.5 rounded-xl relative ${showNotifDropdown ? 'text-rose-500 bg-rose-955/10' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping" />}
          <span className="text-[8.5px] font-bold tracking-wide block leading-none">Alertas</span>
        </button>

        <button
          onClick={handleViewOwnProfile}
          className={`flex flex-col items-center justify-center gap-1 transition-all p-1.5 rounded-xl ${activeTab === 'profile' && selectedUserIdForProfile === currentUser?.id ? 'text-rose-500 bg-rose-955/10' : 'text-zinc-500 hover:text-zinc-300'}`}
          id="mobile_bottom_nav_profile"
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[8.5px] font-bold tracking-wide block leading-none">Perfil</span>
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
