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

    const { chapterId, content, title } = (await request.json()) as {
      chapterId: string;
      content: string;
      title?: string;
    };

    if (!chapterId || !content?.trim()) {
      return NextResponse.json(
        { error: '요약할 회차 본문이 비어 있습니다.' },
        { status: 400 }
      );
    }

    const customKey = request.headers.get('x-gemini-api-key');
    const ai = createGeminiClient(customKey);

    const response = await ai.models.generateContent({
      model: DEFAULT_TEXT_MODEL,
      config: {
        systemInstruction:
          '당신은 소설 편집자입니다. 다음 회차의 핵심 사건, 등장인물의 감정/관계 변화, 떡밥을 3~5문장으로 간결하게 요약하세요.',
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `제목: ${title || '무제'}\n\n본문:\n${content.slice(0, 15000)}`,
            },
          ],
        },
      ],
    });

    const summary = response.text?.trim();
    if (!summary) {
      return NextResponse.json(
        { error: '요약 생성에 실패했습니다.' },
        { status: 502 }
      );
    }

    const { error: updateErr } = await supabase
      .from('chapters')
      .update({ summary })
      .eq('id', chapterId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '요약 생성 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
