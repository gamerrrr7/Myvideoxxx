/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Mail, Lock, User as UserIcon, X, Check, ArrowLeft, Camera, Eye, EyeOff } from 'lucide-react';
import { findUserByEmail, findUserByUsername, saveUserToDB, User } from '../db';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  initialTab?: 'login' | 'signup';
}

export default function AuthModal({ isOpen, onClose, onSuccess, initialTab = 'login' }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'signup' | 'recover'>(initialTab);
  
  // Form states
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [profilePic, setProfilePic] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [recoveredPassword, setRecoveredPassword] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Helper de conversão imagem -> base64
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setError('A imagem do perfil deve ter menos de 5MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setProfilePic(event.target.result as string);
          setError(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (tab === 'signup') {
        const cleanedUsername = username.trim();
        const cleanedEmail = email.trim().toLowerCase();
        
        if (!cleanedUsername || !cleanedEmail || !password) {
          throw new Error('Por favor, preencha todos os campos obrigatórios.');
        }

        if (cleanedUsername.length < 3) {
          throw new Error('O nome de usuário deve ter pelo menos 3 caracteres.');
        }

        if (password.length < 6) {
          throw new Error('A senha deve ter pelo menos 6 caracteres.');
        }

        // Verificar unicidade de email e username
        const existingEmail = await findUserByEmail(cleanedEmail);
        if (existingEmail) {
          throw new Error('Este e-mail já está cadastrado.');
        }

        const existingUsername = await findUserByUsername(cleanedUsername);
        if (existingUsername) {
          throw new Error('Este nome de usuário já está em uso.');
        }

        // Criar usuário real no banco local
        const newUser: User & { passwordHash: string } = {
          id: 'user_' + Date.now(),
          username: cleanedUsername,
          email: cleanedEmail,
          passwordHash: password, // Armazenado localmente de forma simples para simulação
          bio: bio.trim(),
          profilePic: profilePic || undefined,
          createdAt: Date.now()
        };

        await saveUserToDB(newUser);
        
        // Sucesso
        setSuccess('Cadastro realizado com sucesso!');
        setTimeout(() => {
          onSuccess({
            id: newUser.id,
            username: newUser.username,
            email: newUser.email,
            bio: newUser.bio,
            profilePic: newUser.profilePic,
            createdAt: newUser.createdAt
          });
          onClose();
        }, 1200);

      } else if (tab === 'login') {
        const cleanedEmail = email.trim().toLowerCase();
        if (!cleanedEmail || !password) {
          throw new Error('Por favor, insira o e-mail e a senha.');
        }

        const user = await findUserByEmail(cleanedEmail);
        if (!user || user.passwordHash !== password) {
          throw new Error('Credenciais incorretas. Verifique seu e-mail e sua senha.');
        }

        setSuccess('Bem-vindo de volta!');
        setTimeout(() => {
          onSuccess({
            id: user.id,
            username: user.username,
            email: user.email,
            bio: user.bio,
            profilePic: user.profilePic,
            createdAt: user.createdAt
          });
          onClose();
        }, 800);
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro no processamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setRecoveredPassword(null);
    setLoading(true);

    try {
      const cleanedEmail = email.trim().toLowerCase();
      if (!cleanedEmail) {
        throw new Error('Informe o endereço de e-mail cadastrado.');
      }

      const user = await findUserByEmail(cleanedEmail);
      if (!user) {
        throw new Error('Nenhuma conta foi encontrada com esse endereço de e-mail.');
      }

      // Simular envio de e-mail e recuperação local real!
      setSuccess('E-mail localizado!');
      setRecoveredPassword(user.passwordHash);
    } catch (err: any) {
      setError(err.message || 'Não foi possível localizar o e-mail.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordDirectly = async () => {
    if (!email) return;
    try {
      setLoading(true);
      const cleanedEmail = email.trim().toLowerCase();
      const user = await findUserByEmail(cleanedEmail);
      if (user) {
        user.passwordHash = '123456';
        await saveUserToDB(user);
        setRecoveredPassword('123456');
        setSuccess('Sua senha foi redefinida com sucesso para o padrão: 123456');
      }
    } catch (err: any) {
      setError('Erro ao redefinir senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="auth_modal_overlay">
      <div 
        className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
        id="auth_modal_container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-white text-xl tracking-tight">My</span>
            <span className="font-extrabold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent text-xl tracking-tight">Video</span>
            <span className="font-black bg-rose-600 text-white px-1.5 py-0.5 rounded ml-1 text-xs tracking-wider uppercase">XXX</span>
          </div>
          <button 
            type="button"
            className="p-1 px-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            onClick={onClose}
            id="close_auth_modal_btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas */}
        {tab !== 'recover' && (
          <div className="flex border-b border-zinc-800">
            <button
              onClick={() => { setTab('login'); setError(null); setSuccess(null); }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'login' ? 'text-white border-b-2 border-rose-600 bg-zinc-900' : 'text-zinc-400 hover:text-zinc-200 bg-zinc-955'}`}
              id="set_tab_login_btn"
            >
              Entrar
            </button>
            <button
              onClick={() => { setTab('signup'); setError(null); setSuccess(null); }}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'signup' ? 'text-white border-b-2 border-rose-600 bg-zinc-900' : 'text-zinc-400 hover:text-zinc-200 bg-zinc-955'}`}
              id="set_tab_signup_btn"
            >
              Criar Conta
            </button>
          </div>
        )}

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 bg-red-900/30 border border-red-800 text-red-200 p-3 rounded-lg text-sm flex items-center gap-2" id="auth_error_container">
              <span className="shrink-0 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-emerald-950/40 border border-emerald-800 text-emerald-200 p-3 rounded-lg text-sm flex items-center gap-2" id="auth_success_container">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          {tab !== 'recover' ? (
            <form onSubmit={handleAuthSubmit} className="space-y-4" id="auth_form">
              {tab === 'signup' && (
                <>
                  {/* Foto de Perfil */}
                  <div className="flex flex-col items-center justify-center gap-2 mb-2">
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-full border-2 border-zinc-700 bg-zinc-800 hover:border-rose-500 transition-all cursor-pointer overflow-hidden relative flex items-center justify-center group"
                      title="Escolher foto de perfil"
                    >
                      {profilePic ? (
                        <img src={profilePic} alt="Foto de Perfil" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-8 h-8 text-zinc-400 group-hover:text-zinc-200" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] sm:text-xs">
                        {profilePic ? 'Alterar' : 'Escolher'}
                      </div>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageChange} 
                      accept="image/*" 
                      className="hidden" 
                      id="signup_avatar_input"
                    />
                    <span className="text-xs text-zinc-400">Escolha sua foto de perfil</span>
                  </div>

                  {/* Nome de usuário */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Nome de Usuário</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4.5 h-4.5" />
                      <input
                        type="text"
                        required
                        placeholder="Nome de usuário (mínimo 3 letras)"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))} // sem espaços
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600"
                        id="signup_username_input"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4.5 h-4.5" />
                  <input
                    type="email"
                    required
                    placeholder="exemplo@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600"
                    id="auth_email_input"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Senha</label>
                  {tab === 'login' && (
                    <button
                      type="button"
                      onClick={() => setTab('recover')}
                      className="text-xs text-rose-500 hover:text-rose-400 hover:underline transition-all"
                      id="forgot_pwd_btn"
                    >
                      Esqueceu?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4.5 h-4.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder={tab === 'signup' ? 'Mínimo 6 caracteres' : 'Sua senha'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl py-2.5 pl-10 pr-10 text-sm text-white outline-none transition-all placeholder:text-zinc-600"
                    id="auth_password_input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {tab === 'signup' && (
                /* Biografia Opcional */
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Biografia Opcional</label>
                  <textarea
                    placeholder="Fale um pouco sobre você..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={2}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl py-2 px-3 text-sm text-white outline-none transition-all placeholder:text-zinc-600 resize-none"
                    id="signup_bio_input"
                  />
                </div>
              )}

              {/* Botão Principal */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl py-2.5 text-sm font-bold tracking-wide active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none mt-2 shadow-lg shadow-rose-950/20"
                id="auth_submit_btn"
              >
                {loading ? 'Processando...' : tab === 'login' ? 'Entrar' : 'Registrar'}
              </button>
            </form>
          ) : (
            /* Recuperação de Senha */
            <div className="space-y-5" id="recovery_container">
              <button
                onClick={() => { setTab('login'); setError(null); setSuccess(null); setRecoveredPassword(null); }}
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white hover:underline transition-all"
                id="back_to_login_btn"
              >
                <ArrowLeft className="w-3 h-3" /> Voltar ao Login
              </button>

              <div className="text-center space-y-1">
                <h4 className="text-white font-semibold text-base">Recuperar sua senha</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Digite seu e-mail cadastrado e iremos ajudá-lo a recuperar sua senha de acesso local.
                </p>
              </div>

              <form onSubmit={handleRecoverySubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Seu E-mail Cadastrado</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4.5 h-4.5" />
                    <input
                      type="email"
                      required
                      placeholder="seu-email@exemplo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white outline-none transition-all placeholder:text-zinc-600"
                      id="recovery_email_input"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white rounded-xl py-2.5 text-sm font-bold tracking-wide active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-50 mt-2"
                  id="recovery_submit_btn"
                >
                  {loading ? 'Verificando...' : 'Pesquisar Conta'}
                </button>
              </form>

              {recoveredPassword && (
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3 mt-4" id="recovery_result_container">
                  <p className="text-xs text-zinc-400">
                    Sua conta foi localizada no banco de dados local com sucesso!
                  </p>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest block">Sua senha atual</span>
                    <span className="font-mono text-emerald-400 font-bold bg-emerald-950/30 px-2 py-1 rounded text-sm select-all inline-block border border-emerald-900/40 mt-1">
                      {recoveredPassword}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-zinc-800">
                    <p className="text-[11px] text-zinc-400 mb-2">Se preferir, redefina a senha para uma padrão:</p>
                    <button
                      type="button"
                      onClick={handleResetPasswordDirectly}
                      className="text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg transition-colors border border-zinc-700/50"
                    >
                      Redefinir para "123456"
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
