import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  createGeminiClient,
  DEFAULT_TEXT_MODEL,
  generateNovelImage,
} from '@/lib/ai/gemini';
import type { ImageTargetType } from '@/types/novel';

interface ImageRequestBody {
  mode: 'suggest_prompt' | 'generate';
  projectId: string;
  targetType: ImageTargetType;
  targetId?: string | null;
  stylePreset?: string;
  prompt?: string;
  customContext?: string;
  applyToTarget?: boolean;
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

    const body = (await request.json()) as ImageRequestBody;
    const {
      mode,
      projectId,
      targetType,
      targetId,
      stylePreset = 'cinematic fantasy book illustration, rich lighting, detailed',
      prompt,
      customContext,
      applyToTarget = true,
    } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId가 필요합니다.' },
        { status: 400 }
      );
    }

    const { data: project, error: projectErr } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectErr || !project) {
      return NextResponse.json(
        { error: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const customKey = request.headers.get('x-gemini-api-key');

    if (mode === 'suggest_prompt') {
      let targetDescription = `작품 제목: ${project.title}, 장르: ${project.genre}, 로그라인: ${project.logline}`;

      if (targetType === 'character' && targetId) {
        const { data: char } = await supabase
          .from('characters')
          .select('*')
          .eq('id', targetId)
          .single();
        if (char) {
          targetDescription = `등장인물: ${char.name} (${char.role}, 나이: ${char.age}), 외모: ${char.appearance}, 성격: ${char.personality}, 배경: ${char.background}`;
        }
      } else if (targetType === 'world' && targetId) {
        const { data: world } = await supabase
          .from('world_settings')
          .select('*')
          .eq('id', targetId)
          .single();
        if (world) {
          targetDescription = `세계관 [${world.category}] ${world.title}: ${world.description}`;
        }
      } else if (targetType === 'scene' && targetId) {
        const { data: chapter } = await supabase
          .from('chapters')
          .select('title, summary, content')
          .eq('id', targetId)
          .single();
        if (chapter) {
          targetDescription = `장면 (${chapter.title}): ${chapter.summary || chapter.content.slice(0, 1200)}`;
        }
      }

      if (customContext?.trim()) {
        targetDescription += `\n추가 요청: ${customContext.trim()}`;
      }

      const ai = createGeminiClient(customKey);
      const promptRes = await ai.models.generateContent({
        model: DEFAULT_TEXT_MODEL,
        config: {
          systemInstruction:
            'You are an expert AI image prompt engineer for novel illustrations. ' +
            'Convert the given Korean novel setting into ONE vivid, detailed English image generation prompt. ' +
            'Include composition, lighting, mood, character/environment details, and the requested art style. ' +
            'Avoid text/letters inside the image. Output ONLY the English prompt.',
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Target type: ${targetType}\nArt style: ${stylePreset}\nSetting:\n${targetDescription}`,
              },
            ],
          },
        ],
      });

      return NextResponse.json({
        suggestedPrompt: promptRes.text?.trim() || '',
      });
    }

    // mode === 'generate'
    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: '이미지 생성 프롬프트가 필요합니다.' },
        { status: 400 }
      );
    }

    const generated = await generateNovelImage(prompt.trim(), customKey);
    const ext = generated.mimeType.includes('jpeg') ? 'jpg' : 'png';
    const storagePath = `${user.id}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('novel-images')
      .upload(storagePath, generated.buffer, {
        contentType: generated.mimeType,
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json(
        { error: `이미지 스토리지 업로드 실패: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from('novel-images')
      .getPublicUrl(storagePath);

    const imageUrl = publicUrlData.publicUrl;

    const { data: imageRecord, error: insertErr } = await supabase
      .from('project_images')
      .insert({
        project_id: projectId,
        target_type: targetType,
        target_id: targetId ?? null,
        prompt: prompt.trim(),
        image_url: imageUrl,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    if (applyToTarget) {
      if (targetType === 'cover') {
        await supabase
          .from('projects')
          .update({ cover_image_url: imageUrl })
          .eq('id', projectId);
      } else if (targetType === 'character' && targetId) {
        await supabase
          .from('characters')
          .update({ avatar_image_url: imageUrl })
          .eq('id', targetId);
      } else if (targetType === 'world' && targetId) {
        await supabase
          .from('world_settings')
          .update({ image_url: imageUrl })
          .eq('id', targetId);
      }
    }

    return NextResponse.json({ image: imageRecord });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : '이미지 생성 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
