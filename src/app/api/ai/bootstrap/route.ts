import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createGeminiClient, DEFAULT_TEXT_MODEL } from '@/lib/ai/gemini';

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

    const { title, genre, idea } = (await request.json()) as {
      title: string;
      genre: string;
      idea: string;
    };

    if (!idea?.trim()) {
      return NextResponse.json(
        { error: '작품 아이디어나 키워드를 입력해주세요.' },
        { status: 400 }
      );
    }

    const customKey = request.headers.get('x-gemini-api-key');
    const ai = createGeminiClient(customKey);

    const response = await ai.models.generateContent({
      model: DEFAULT_TEXT_MODEL,
      config: {
        responseMimeType: 'application/json',
        systemInstruction:
          '당신은 한국어 소설 기획 전문가입니다. 사용자가 준 제목, 장르, 아이디어를 바탕으로 ' +
          '다음 JSON 스키마에 맞춰 로그라인, 시놉시스, 주인공 2명, 핵심 세계관 2개, 기승전결 플롯 4단계를 생성하세요.\n' +
          'JSON 형식: {"logline": string, "synopsis": string, "characters": [{"name": string, "role": string, "appearance": string, "personality": string, "background": string}], "worldSettings": [{"category": string, "title": string, "description": string}], "plotNodes": [{"act_label": "기"|"승"|"전"|"결", "title": string, "description": string}]}',
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `제목: ${title || '미정'}\n장르: ${genre || '판타지'}\n아이디어: ${idea}`,
            },
          ],
        },
      ],
    });

    const raw = response.text?.trim();
    if (!raw) {
      return NextResponse.json(
        { error: 'AI 기획안 생성에 실패했습니다.' },
        { status: 502 }
      );
    }

    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '기획안 생성 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
