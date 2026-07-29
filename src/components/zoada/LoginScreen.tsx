'use client';

import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Zap, UserPlus } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { DEMO_USER } from '@/lib/demo-data';
import GradientButton from './GradientButton';
import Equalizer from './Equalizer';

const LoginScreen: React.FC = () => {
  const { setUser } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Preencha email e senha');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.demo) {
        // Backend disse explicitamente que o Neon não está configurado —
        // aí sim faz sentido cair em modo demo (sem token real).
        await new Promise(resolve => setTimeout(resolve, 400));
        setUser({
          ...DEMO_USER,
          email,
          name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        }, null);
        return;
      }

      if (!res.ok || data.error) {
        // Erro de verdade (ex: senha incorreta) — mostra pro usuário,
        // NÃO loga como demo, senão ele acaba "logado" sem token real.
        setError(data.error || 'Não foi possível entrar. Tente novamente.');
        return;
      }

      setUser({
        id: data.id,
        email: data.email,
        name: data.name,
        avatar_url: data.avatar_url,
        created_at: data.created_at,
      }, data.token);
    } catch {
      // Erro de rede de verdade (backend inacessível) — aqui sim faz
      // sentido oferecer o modo demo, mas avisando o usuário.
      setError('Não foi possível conectar ao servidor. Tente novamente ou use o modo demo.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password) {
      setError('Preencha email e senha');
      return;
    }
    if (password.length < 6) {
      setError('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || email.split('@')[0] }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao criar conta');
        return;
      }

      if (data.error) {
        setError(data.error);
        return;
      }

      // Auto-login after register
      setUser({
        id: data.id,
        email: data.email,
        name: data.name,
        avatar_url: data.avatar_url,
        created_at: data.created_at,
      }, data.token);
    } catch {
      setError('Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (mode === 'login') handleLogin();
    else handleRegister();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/4 -left-20 w-60 h-60 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #FF8C42, transparent)' }}
      />
      <div className="absolute bottom-1/3 -right-20 w-80 h-80 rounded-full opacity-15 blur-3xl"
        style={{ background: 'radial-gradient(circle, #E84393, transparent)' }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #6C5CE7, transparent)' }}
      />

      <div className="w-full max-w-sm z-10 fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-6">
            <img
              src="/zoada-logo.png"
              alt="Zôada Logo"
              className="w-48 h-48 object-contain drop-shadow-2xl"
            />
          </div>
          <h1 className="text-2xl font-bold gradient-text mb-2">
            MÚSICA. SEM RÓTULOS.
          </h1>
          <p className="text-foreground/40 text-sm">
            {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4 mb-6">
          {mode === 'register' && (
            <div className="relative">
              <UserPlus size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" />
              <input
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="!pl-11"
                autoComplete="name"
              />
            </div>
          )}
          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input
              type="email"
              placeholder="Seu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="!pl-11"
              autoComplete="email"
            />
          </div>
          <div className="relative">
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="!pl-11 !pr-11"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/70 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center mb-4 fade-in">{error}</p>
        )}

        <GradientButton
          onClick={handleSubmit}
          loading={loading}
          className="w-full mb-3"
          icon={<Zap size={18} />}
        >
          {mode === 'login' ? 'Entrar' : 'Criar Conta'}
        </GradientButton>

        {/* Toggle mode */}
        <button
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          className="w-full text-center text-foreground/40 text-sm hover:text-foreground/70 transition-colors py-1"
        >
          {mode === 'login' ? 'Não tem conta? Criar conta' : 'Já tem conta? Fazer login'}
        </button>

        {/* Equalizer decoration */}
        <div className="flex justify-center mt-10">
          <Equalizer barCount={7} height={28} barWidth={3} gap={3} />
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
