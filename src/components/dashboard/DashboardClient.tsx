'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Sparkles,
  Trash2,
  LogOut,
  KeyRound,
  Loader2,
  ArrowRight,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  buildAIHeaders,
  getCustomGeminiKey,
  setCustomGeminiKey,
} from '@/lib/ai/client-key';
import type { Project } from '@/types/novel';

interface Props {
  userEmail: string;
  initialProjects: Project[];
}

const GENRES = [
  '판타지',
  '현대 판타지',
  '로맨스',
  '로맨스 판타지',
  '무협',
  'SF',
  '미스터리/스릴러',
  '드라마/일반소설',
];

export default function DashboardClient({ userEmail, initialProjects }: Props) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [customKeyInput, setCustomKeyInput] = useState(() =>
    getCustomGeminiKey()
  );

  // Create form state
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('판타지');
  const [idea, setIdea] = useState('');
  const [useAIBootstrap, setUseAIBootstrap] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setCreateError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      let logline = idea.trim();
      let synopsis = '';
      let bootstrapData: {
        logline?: string;
        synopsis?: string;
        characters?: Array<{
          name: string;
          role: string;
          appearance: string;
          personality: string;
          background: string;
        }>;
        worldSettings?: Array<{
          category: string;
          title: string;
          description: string;
        }>;
        plotNodes?: Array<{
          act_label: string;
          title: string;
          description: string;
        }>;
      } | null = null;

      if (useAIBootstrap && idea.trim()) {
        const res = await fetch('/api/ai/bootstrap', {
          method: 'POST',
          headers: buildAIHeaders(),
          body: JSON.stringify({ title: title.trim(), genre, idea: idea.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'AI 초기 기획 생성에 실패했습니다.');
        }
        bootstrapData = data;
        logline = data.logline || logline;
        synopsis = data.synopsis || '';
      }

      const { data: project, error: projErr } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          title: title.trim(),
          genre,
          logline,
          synopsis,
        })
        .select()
        .single();

      if (projErr || !project) {
        throw new Error(projErr?.message || '프로젝트 생성 실패');
      }

      // Create initial Chapter 1
      await supabase.from('chapters').insert({
        project_id: project.id,
        order_index: 0,
        title: '1화. 프롤로그',
        content: '',
        status: 'draft',
      });

      if (bootstrapData) {
        if (bootstrapData.characters?.length) {
          await supabase.from('characters').insert(
            bootstrapData.characters.map((c) => ({
              project_id: project.id,
              name: c.name,
              role: c.role || '주연',
              appearance: c.appearance || '',
              personality: c.personality || '',
              background: c.background || '',
            }))
          );
        }
        if (bootstrapData.worldSettings?.length) {
          await supabase.from('world_settings').insert(
            bootstrapData.worldSettings.map((w) => ({
              project_id: project.id,
              category: w.category || '배경',
              title: w.title,
              description: w.description || '',
            }))
          );
        }
        if (bootstrapData.plotNodes?.length) {
          await supabase.from('plot_nodes').insert(
            bootstrapData.plotNodes.map((p, idx) => ({
              project_id: project.id,
              order_index: idx,
              act_label: p.act_label || '기',
              title: p.title,
              description: p.description || '',
            }))
          );
        }
      }

      router.push(`/project/${project.id}`);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : '프로젝트 생성 중 오류 발생'
      );
      setCreating(false);
    }
  }

  async function handleDeleteProject(id: string) {
    if (!confirm('정말로 이 소설 프로젝트와 모든 회차/설정을 삭제하시겠습니까?')) {
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (!error) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    }
  }

  function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    setCustomGeminiKey(customKeyInput);
    setShowKeyModal(false);
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-stone-950">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="text-base font-bold tracking-tight">
              NovelForge
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-stone-500 sm:inline">
              {userEmail}
            </span>
            <button
              type="button"
              onClick={() => setShowKeyModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
            >
              <KeyRound className="h-3.5 w-3.5" />
              API 키 설정
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
            >
              <LogOut className="h-3.5 w-3.5" />
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">
              내 소설 프로젝트
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              작품을 선택해 집필 스튜디오로 들어가거나 새 소설을 시작하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800"
          >
            <Plus className="h-4 w-4" />새 소설 프로젝트
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-white py-20 text-center">
            <BookOpen className="mb-4 h-10 w-10 text-stone-300" />
            <h2 className="text-base font-semibold text-stone-800">
              아직 생성된 소설 프로젝트가 없습니다
            </h2>
            <p className="mt-1 max-w-sm text-sm text-stone-500">
              제목과 간단한 아이디어만 입력하면 AI가 초기 시놉시스와 등장인물,
              플롯 초안까지 함께 만들어 드립니다.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-stone-950 transition hover:bg-amber-400"
            >
              <Sparkles className="h-4 w-4" />첫 번째 소설 시작하기
            </button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:border-amber-400 hover:shadow-md"
              >
                <div>
                  <div className="relative h-40 w-full bg-gradient-to-br from-stone-800 to-stone-900">
                    {project.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={project.cover_image_url}
                        alt={project.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-stone-600">
                        <BookOpen className="h-10 w-10 opacity-40" />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 rounded-full bg-stone-950/75 px-2.5 py-1 text-[11px] font-medium text-amber-300 backdrop-blur">
                      {project.genre}
                    </span>
                  </div>

                  <div className="p-5">
                    <h2 className="line-clamp-1 font-serif text-lg font-bold text-stone-900">
                      {project.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-stone-500">
                      {project.logline || '로그라인이 아직 작성되지 않았습니다.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-stone-100 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => handleDeleteProject(project.id)}
                    className="rounded-lg p-1.5 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                    title="프로젝트 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <Link
                    href={`/project/${project.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-500 hover:text-stone-950"
                  >
                    집필 스튜디오 열기
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-900">
                새 소설 프로젝트 만들기
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  소설 제목 *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 잿빛 탑의 연금술사"
                  className="w-full rounded-lg border border-stone-300 px-3.5 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  장르
                </label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3.5 py-2 text-sm focus:border-amber-500 focus:outline-none"
                >
                  {GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  초기 아이디어 / 로그라인
                </label>
                <textarea
                  rows={3}
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="예: 기억을 연료로 쓰는 마법 도시에서, 자신의 과거를 잃은 견습 연금술사가 금지된 탑의 비밀을 파헤치는 이야기"
                  className="w-full rounded-lg border border-stone-300 px-3.5 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                <input
                  type="checkbox"
                  checked={useAIBootstrap}
                  onChange={(e) => setUseAIBootstrap(e.target.checked)}
                  className="mt-0.5 accent-amber-600"
                />
                <div className="text-xs">
                  <span className="flex items-center gap-1 font-semibold text-amber-900">
                    <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                    AI로 초기 시놉시스·등장인물·세계관·플롯 자동 구성
                  </span>
                  <p className="mt-0.5 text-amber-700">
                    입력한 아이디어를 바탕으로 스튜디오에 기본 설정집을 미리
                    채워둡니다. (언제든 수정 가능)
                  </p>
                </div>
              </label>

              {createError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {createError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-5 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {creating ? '생성 중...' : '프로젝트 생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Gemini API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-stone-900">
                개인 Gemini API 키 설정 (선택)
              </h2>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-xs leading-relaxed text-stone-500">
              비워두면 서버에 설정된 기본 API 키를 사용합니다. 개인 키를
              입력하면 브라우저 로컬 스토리지에만 저장되어 AI 요청 시 우선
              사용됩니다.
            </p>
            <form onSubmit={handleSaveKey} className="space-y-4">
              <input
                type="password"
                value={customKeyInput}
                onChange={(e) => setCustomKeyInput(e.target.value)}
                placeholder="AIza..."
                className="w-full rounded-lg border border-stone-300 px-3.5 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCustomKeyInput('');
                    setCustomGeminiKey('');
                    setShowKeyModal(false);
                  }}
                  className="rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  초기화
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
