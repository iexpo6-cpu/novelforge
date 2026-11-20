import type {
  AIActionType,
  Chapter,
  Character,
  PlotNode,
  Project,
  WorldSetting,
} from '@/types/novel';

export interface NovelContextInput {
  project: Pick<Project, 'title' | 'genre' | 'logline' | 'synopsis'>;
  characters: Character[];
  worldSettings: WorldSetting[];
  plotNodes: PlotNode[];
  chapters: Chapter[];
  currentChapterId?: string | null;
  includeCharacters?: boolean;
  includeWorld?: boolean;
  includePlot?: boolean;
  includePreviousSummaries?: boolean;
  maxChapterChars?: number;
}

const DEFAULT_MAX_CHAPTER_CHARS = 6000;

/**
 * Truncates long chapter text while preserving the most recent narrative context.
 */
export function truncateTail(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `...(앞부분 생략)...\n${text.slice(text.length - maxChars)}`;
}

/**
 * Builds a structured Korean context block from the novel's bible and current chapter.
 */
export function buildNovelContext(input: NovelContextInput): string {
  const {
    project,
    characters,
    worldSettings,
    plotNodes,
    chapters,
    currentChapterId,
    includeCharacters = true,
    includeWorld = true,
    includePlot = true,
    includePreviousSummaries = true,
    maxChapterChars = DEFAULT_MAX_CHAPTER_CHARS,
  } = input;

  const sections: string[] = [];

  sections.push(
    [
      '## 작품 기본 정보',
      `- 제목: ${project.title}`,
      `- 장르: ${project.genre}`,
      project.logline ? `- 로그라인: ${project.logline}` : null,
      project.synopsis ? `- 시놉시스:\n${project.synopsis}` : null,
    ]
      .filter(Boolean)
      .join('\n')
  );

  if (includeCharacters && characters.length > 0) {
    const charLines = characters.map((c) => {
      const details = [
        c.role ? `역할: ${c.role}` : null,
        c.age ? `나이: ${c.age}` : null,
        c.appearance ? `외모: ${c.appearance}` : null,
        c.personality ? `성격: ${c.personality}` : null,
        c.background ? `배경: ${c.background}` : null,
        c.relationships ? `관계: ${c.relationships}` : null,
        ...(c.custom_fields ?? [])
          .filter((f) => f.label.trim() && f.value.trim())
          .map((f) => `${f.label}: ${f.value}`),
      ]
        .filter(Boolean)
        .join(' / ');
      return `- **${c.name}**${details ? ` (${details})` : ''}`;
    });
    sections.push(`## 등장인물 설정\n${charLines.join('\n')}`);
  }

  if (includeWorld && worldSettings.length > 0) {
    const worldLines = worldSettings.map(
      (w) => `- [${w.category}] **${w.title}**: ${w.description}`
    );
    sections.push(`## 세계관 설정\n${worldLines.join('\n')}`);
  }

  if (includePlot && plotNodes.length > 0) {
    const sortedPlot = [...plotNodes].sort((a, b) => a.order_index - b.order_index);
    const plotLines = sortedPlot.map(
      (p, idx) => `${idx + 1}. [${p.act_label}] **${p.title}**: ${p.description}`
    );
    sections.push(`## 전체 줄거리(플롯)\n${plotLines.join('\n')}`);
  }

  const sortedChapters = [...chapters].sort(
    (a, b) => a.order_index - b.order_index
  );
  const currentChapter = currentChapterId
    ? sortedChapters.find((c) => c.id === currentChapterId)
    : undefined;

  if (includePreviousSummaries && sortedChapters.length > 0) {
    const currentIndex = currentChapter
      ? currentChapter.order_index
      : Number.MAX_SAFE_INTEGER;
    const prevSummaries = sortedChapters
      .filter((c) => c.order_index < currentIndex && c.summary.trim().length > 0)
      .slice(-5)
      .map((c) => `- ${c.title}: ${c.summary.trim()}`);

    if (prevSummaries.length > 0) {
      sections.push(`## 이전 회차 요약\n${prevSummaries.join('\n')}`);
    }
  }

  if (currentChapter) {
    const body = currentChapter.content.trim()
      ? truncateTail(currentChapter.content, maxChapterChars)
      : '(아직 작성된 본문이 없습니다.)';
    sections.push(`## 현재 집필 중인 회차: ${currentChapter.title}\n${body}`);
  }

  return sections.join('\n\n');
}

/**
 * Returns a tailored system instruction based on the selected AI action type.
 */
export function getSystemInstruction(actionType: AIActionType): string {
  const base =
    '당신은 한국어 소설 작가를 돕는 전문 편집자이자 공동 창작 파트너입니다. ' +
    '반드시 제공된 작품 설정(등장인물, 세계관, 줄거리, 이전 회차 요약)과의 일관성을 최우선으로 유지하세요.';

  switch (actionType) {
    case 'feedback':
      return (
        `${base} 현재 원고에 대해 (1) 잘된 점, (2) 개연성/설정 충돌 위험, ` +
        `(3) 감정선·몰입감·문체 개선 포인트를 구체적이고 건설적으로 피드백하세요.`
      );
    case 'polish':
      return (
        `${base} 작가의 고유한 문체와 의도를 해치지 않으면서 비문, 중복 표현, 어색한 호흡을 다듬고 ` +
        `생동감 있는 묘사로 윤문한 결과와 핵심 수정 이유를 제시하세요.`
      );
    case 'continue':
      return (
        `${base} 현재 원고의 마지막 문장·분위기·시점을 자연스럽게 이어받아 다음 2~4문단을 집필하세요. ` +
        `설명이나 사족 없이 바로 소설 본문에 삽입할 수 있는 문장으로 출력하세요.`
      );
    case 'brainstorm':
      return (
        `${base} 기존 설정을 기반으로 흥미로운 갈등, 반전, 사건 아이디어나 새로운 인물/세계관 요소를 ` +
        `3가지 내외의 구체적인 선택지로 제안하세요.`
      );
    case 'plan':
      return (
        `${base} 작품의 장르와 로그라인에 어울리는 체계적인 줄거리(기승전결), 매력적인 등장인물, ` +
        `독창적인 세계관 설정을 구조화하여 제안하세요.`
      );
    case 'chat':
    default:
      return `${base} 작가의 질문에 정확하고 창의적이며 실용적으로 답변하세요.`;
  }
}
