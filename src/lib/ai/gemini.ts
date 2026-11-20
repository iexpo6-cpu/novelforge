import { GoogleGenAI } from '@google/genai';

export const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash';
export const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';

/**
 * Resolves the Gemini API key from a request header (BYOK) or server environment.
 */
export function resolveGeminiApiKey(customKey?: string | null): string {
  const trimmed = customKey?.trim();
  const apiKey = trimmed || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Gemini API 키가 설정되지 않았습니다. 서버 .env.local 또는 우측 상단 API 키 설정에서 키를 입력해주세요.'
    );
  }
  return apiKey;
}

export function createGeminiClient(customKey?: string | null): GoogleGenAI {
  return new GoogleGenAI({ apiKey: resolveGeminiApiKey(customKey) });
}

export interface GeneratedImageResult {
  buffer: Buffer;
  mimeType: string;
  caption?: string;
}

/**
 * Generates an image using Gemini's multimodal image generation model and returns raw bytes.
 */
export async function generateNovelImage(
  prompt: string,
  customKey?: string | null
): Promise<GeneratedImageResult> {
  const ai = createGeminiClient(customKey);

  const response = await ai.models.generateContent({
    model: DEFAULT_IMAGE_MODEL,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || 'image/png';
      const buffer = Buffer.from(part.inlineData.data, 'base64');
      return {
        buffer,
        mimeType,
        caption: response.text || undefined,
      };
    }
  }

  throw new Error(
    '이미지 생성 응답에서 이미지 데이터를 찾지 못했습니다. 프롬프트를 수정해 다시 시도해주세요.'
  );
}
