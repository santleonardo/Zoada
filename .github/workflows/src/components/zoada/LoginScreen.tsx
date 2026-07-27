'use client';

import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Zap } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { DEMO_USER } from '@/lib/demo-data';
import GradientButton from './GradientButton';
import Equalizer from './Equalizer';

const LoginScreen: React.FC = () => {
  const { setUser } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Preencha email e senha');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // TODO: Replace with Supabase Auth when configured
      // const { data, error } = await supabase.auth.signInWithPassword({
      //   email,
      //   password,
      // });

      // Simulate login with demo user
      await new Promise(resolve => setTimeout(resolve, 800));
      setUser({
        ...DEMO_USER,
        email,
        name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      });
    } catch {
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setEmail('demo@zoada.com');
    setPassword('demo123');
    setLoading(true);
    setTimeout(() => {
      setUser(DEMO_USER);
      setLoading(false);
    }, 500);
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
          <p className="text-white/40 text-sm">
            Descubra, compartilhe e conecte-se através da música
          </p>
        </div>

        {/* Login Form */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
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
            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="!pl-11 !pr-11"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center mb-4 fade-in">{error}</p>
        )}

        <GradientButton
          onClick={handleLogin}
          loading={loading}
          className="w-full mb-3"
          icon={<Zap size={18} />}
        >
          Entrar
        </GradientButton>

        <button
          onClick={handleDemoLogin}
          className="w-full text-center text-white/40 text-sm hover:text-white/60 transition-colors py-2"
        >
          Entrar como demo
        </button>

        {/* Equalizer decoration */}
        <div className="flex justify-center mt-12">
          <Equalizer barCount={7} height={28} barWidth={3} gap={3} />
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
