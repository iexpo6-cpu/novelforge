import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  buildNovelContext,
  getSystemInstruction,
} from '@/lib/ai/context-builder';
import { createGeminiClient, DEFAULT_TEXT_MODEL } from '@/lib/ai/gemini';
import type { AIActionType } from '@/types/novel';

interface AssistRequestBody {
  projectId: string;
  chapterId?: string | null;
  actionType?: AIActionType;
  prompt: string;
  currentContentOverride?: string;
  includeCharacters?: boolean;
  includeWorld?: boolean;
  includePlot?: boolean;
  includePreviousSummaries?: boolean;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as AssistRequestBody;
    const {
      projectId,
      chapterId,
      actionType = 'chat',
      prompt,
      currentContentOverride,
      includeCharacters = true,
      includeWorld = true,
      includePlot = true,
      includePreviousSummaries = true,
    } = body;

    if (!projectId || !prompt?.trim()) {
      return NextResponse.json(
        { error: 'projectId와 prompt가 필요합니다.' },
        { status: 400 }
      );
    }

    const [
      { data: project, error: projectErr },
      { data: characters },
      { data: worldSettings },
      { data: plotNodes },
      { data: chapters },
    ] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase.from('characters').select('*').eq('project_id', projectId),
      supabase.from('world_settings').select('*').eq('project_id', projectId),
      supabase
        .from('plot_nodes')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true }),
      supabase
        .from('chapters')
        .select('*')
        .eq('project_id', projectId)
        .order('order_index', { ascending: true }),
    ]);

    if (projectErr || !project) {
      return NextResponse.json(
        { error: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const effectiveChapters = (chapters ?? []).map((c) =>
      c.id === chapterId && typeof currentContentOverride === 'string'
        ? { ...c, content: currentContentOverride }
        : c
    );

    const contextBlock = buildNovelContext({
      project,
      characters: characters ?? [],
      worldSettings: worldSettings ?? [],
      plotNodes: plotNodes ?? [],
      chapters: effectiveChapters,
      currentChapterId: chapterId,
      includeCharacters,
      includeWorld,
      includePlot,
      includePreviousSummaries,
    });

    const systemInstruction = getSystemInstruction(actionType);
    const customKey = request.headers.get('x-gemini-api-key');
    const ai = createGeminiClient(customKey);

    const response = await ai.models.generateContent({
      model: DEFAULT_TEXT_MODEL,
      config: {
        systemInstruction,
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${contextBlock}\n\n---\n### 작가의 요청\n${prompt.trim()}`,
            },
          ],
        },
      ],
    });

    const reply = response.text?.trim();
    if (!reply) {
      return NextResponse.json(
        { error: 'AI 응답을 생성하지 못했습니다.' },
        { status: 502 }
      );
    }

    // Save conversation history
    await supabase.from('ai_chat_messages').insert([
      {
        project_id: projectId,
        chapter_id: chapterId ?? null,
        role: 'user',
        content: prompt.trim(),
        action_type: actionType,
      },
      {
        project_id: projectId,
        chapter_id: chapterId ?? null,
        role: 'assistant',
        content: reply,
        action_type: actionType,
      },
    ]);

    return NextResponse.json({ reply });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'AI 처리 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
