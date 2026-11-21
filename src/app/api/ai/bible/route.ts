import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createGeminiClient, DEFAULT_TEXT_MODEL } from '@/lib/ai/gemini';
import { buildNovelContext } from '@/lib/ai/context-builder';

interface BibleRequestBody {
  projectId: string;
  targetType: 'character' | 'world' | 'plot';
  instruction: string;
  customFieldLabels?: string[];
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

    const { projectId, targetType, instruction, customFieldLabels = [] } =
      (await request.json()) as BibleRequestBody;

    if (!projectId || !targetType || !instruction?.trim()) {
      return NextResponse.json(
        { error: 'projectId, targetType, instruction이 필요합니다.' },
        { status: 400 }
      );
    }

    const [
      { data: project, error: projErr },
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

    if (projErr || !project) {
      return NextResponse.json(
        { error: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const contextBlock = buildNovelContext({
      project,
      characters: characters ?? [],
      worldSettings: worldSettings ?? [],
      plotNodes: plotNodes ?? [],
      chapters: chapters ?? [],
    });

    // Collect existing custom field labels from previously created characters if not explicitly provided
    const existingCharLabels = Array.from(
      new Set([
        ...customFieldLabels.map((l) => l.trim()).filter(Boolean),
        ...(characters ?? []).flatMap((c) =>
          (c.custom_fields ?? [])
            .map((f: { label?: string }) => f.label?.trim() ?? '')
            .filter(Boolean)
        ),
      ])
    );

    const customFieldsPrompt =
      targetType === 'character' && existingCharLabels.length > 0
        ? `\n중요: 기존 인물 설정 양식에 맞춰 custom_fields 배열에 다음 항목명(label)들을 반드시 모두 포함해 구체적인 내용을 채워주세요: ${existingCharLabels.join(', ')}`
        : '';

    const schemaInstruction =
      targetType === 'character'
        ? `JSON 스키마: {"name": string, "role": string, "age": string, "tags": string[], "appearance": string, "personality": string, "background": string, "relationships": string, "free_notes": string, "custom_fields": [{"label": string, "value": string}]}${customFieldsPrompt}`
        : targetType === 'world'
          ? 'JSON 스키마: {"category": "장소"|"마법/기술"|"세력/조직"|"역사/사건"|"규칙/기타", "title": string, "description": string}'
          : 'JSON 스키마: {"act_label": "기"|"승"|"전"|"결"|"에필로그", "title": string, "description": string}';

    const customKey = request.headers.get('x-gemini-api-key');
    const ai = createGeminiClient(customKey);

    const response = await ai.models.generateContent({
      model: DEFAULT_TEXT_MODEL,
      config: {
        responseMimeType: 'application/json',
        systemInstruction:
          '당신은 소설 설정집 기획 전문가입니다. 기존 작품 설정과 자연스럽게 어우러지는 상세하고 입체적인 설정을 생성하세요. ' +
          `반드시 다음 JSON 형식으로만 응답하세요.\n${schemaInstruction}`,
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${contextBlock}\n\n---\n### 생성 요청 (${targetType})\n${instruction.trim()}`,
            },
          ],
        },
      ],
    });

    const raw = response.text?.trim();
    if (!raw) {
      return NextResponse.json(
        { error: 'AI 설정 생성에 실패했습니다.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ item: JSON.parse(raw) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '설정 생성 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
