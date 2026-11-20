'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push('/dashboard');
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage({
          type: 'success',
          text: '회원가입이 완료되었습니다. 이메일 인증 설정에 따라 확인 메일을 체크하거나 바로 로그인해 주세요.',
        });
        setMode('login');
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : '인증 처리 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950 px-4 text-stone-100">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2.5 text-stone-100 transition hover:text-amber-400"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 ring-1 ring-amber-400/30">
          <BookOpen className="h-5 w-5" />
        </div>
        <span className="text-xl font-bold tracking-tight">NovelForge</span>
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-stone-800 bg-stone-900 p-8 shadow-2xl">
        <div className="mb-6 flex rounded-lg bg-stone-950 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setMessage(null);
            }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === 'login'
                ? 'bg-stone-800 text-white shadow'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setMessage(null);
            }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === 'signup'
                ? 'bg-stone-800 text-white shadow'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-300">
              이메일
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="writer@example.com"
              className="w-full rounded-lg border border-stone-700 bg-stone-950 px-3.5 py-2.5 text-sm text-white placeholder-stone-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-300">
              비밀번호 (6자 이상)
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-stone-700 bg-stone-950 px-3.5 py-2.5 text-sm text-white placeholder-stone-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {message && (
            <div
              className={`rounded-lg px-3.5 py-2.5 text-xs leading-relaxed ${
                message.type === 'error'
                  ? 'border border-red-500/30 bg-red-500/10 text-red-300'
                  : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-stone-950 transition hover:bg-amber-400 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? '스튜디오 들어가기' : '계정 만들기'}
          </button>
        </form>
      </div>
    </div>
  );
}
