import { describe, it, expect } from 'vitest';
import {
  buildNovelContext,
  getSystemInstruction,
  truncateTail,
} from '../context-builder';
import type { Chapter, Character, PlotNode, WorldSetting } from '@/types/novel';

describe('context-builder', () => {
  const project = {
    title: '잿빛 탑의 연금술사',
    genre: '판타지',
    logline: '기억을 연료로 쓰는 도시의 비밀을 파헤치는 이야기',
    synopsis: '주인공 카엘이 잊힌 기억을 찾아 탑에 오른다.',
  };

  const characters: Character[] = [
    {
      id: 'char-1',
      project_id: 'proj-1',
      folder: '주인공 일행',
      name: '카엘',
      role: '주인공',
      age: '22',
      appearance: '은발, 잿빛 눈동자',
      personality: '냉철하지만 내면이 따뜻함',
      background: '기억을 잃은 견습 연금술사',
      relationships: '',
      avatar_image_url: null,
      created_at: '',
      updated_at: '',
    },
  ];

  const worldSettings: WorldSetting[] = [
    {
      id: 'world-1',
      project_id: 'proj-1',
      folder: '마법 체계',
      category: '마법/기술',
      title: '기억 연금술',
      description: '개인의 기억을 결정화해 마력으로 치환하는 기술',
      tags: [],
      image_url: null,
      created_at: '',
      updated_at: '',
    },
  ];

  const plotNodes: PlotNode[] = [
    {
      id: 'plot-1',
      project_id: 'proj-1',
      folder: '1부',
      order_index: 0,
      act_label: '기',
      title: '금지된 서고 발견',
      description: '카엘이 지하 서고에서 자신의 이름이 적힌 결정을 발견한다.',
      chapter_id: null,
      created_at: '',
      updated_at: '',
    },
  ];

  const chapters: Chapter[] = [
    {
      id: 'chap-1',
      project_id: 'proj-1',
      order_index: 0,
      title: '1화. 잿빛 아침',
      content: '긴 본문...',
      summary: '카엘이 도시에 도착해 연금술 길드에 합류했다.',
      word_count: 100,
      status: 'completed',
      created_at: '',
      updated_at: '',
    },
    {
      id: 'chap-2',
      project_id: 'proj-1',
      order_index: 1,
      title: '2화. 지하 서고',
      content: '카엘은 촛불을 들고 계단을 내려갔다.',
      summary: '',
      word_count: 20,
      status: 'writing',
      created_at: '',
      updated_at: '',
    },
  ];

  it('includes characters, world settings, plot, previous summaries, and current chapter', () => {
    const result = buildNovelContext({
      project,
      characters,
      worldSettings,
      plotNodes,
      chapters,
      currentChapterId: 'chap-2',
    });

    expect(result).toContain('잿빛 탑의 연금술사');
    expect(result).toContain('카엘');
    expect(result).toContain('기억 연금술');
    expect(result).toContain('금지된 서고 발견');
    expect(result).toContain('1화. 잿빛 아침: 카엘이 도시에 도착해 연금술 길드에 합류했다.');
    expect(result).toContain('현재 집필 중인 회차: 2화. 지하 서고');
    expect(result).toContain('카엘은 촛불을 들고 계단을 내려갔다.');
  });

  it('respects toggle flags to omit sections when disabled', () => {
    const result = buildNovelContext({
      project,
      characters,
      worldSettings,
      plotNodes,
      chapters,
      currentChapterId: 'chap-2',
      includeCharacters: false,
      includeWorld: false,
      includePlot: false,
      includePreviousSummaries: false,
    });

    expect(result).not.toContain('등장인물 설정');
    expect(result).not.toContain('세계관 설정');
    expect(result).not.toContain('전체 줄거리');
    expect(result).not.toContain('이전 회차 요약');
    expect(result).toContain('현재 집필 중인 회차: 2화. 지하 서고');
  });

  it('truncates long chapter bodies from the start while keeping the tail', () => {
    const longText = 'A'.repeat(100) + 'TAIL_MARKER';
    const truncated = truncateTail(longText, 20);
    expect(truncated).toContain('앞부분 생략');
    expect(truncated).toContain('TAIL_MARKER');
  });

  it('returns distinct system instructions per action type', () => {
    expect(getSystemInstruction('feedback')).toContain('개연성');
    expect(getSystemInstruction('continue')).toContain('이어받아');
    expect(getSystemInstruction('polish')).toContain('윤문');
  });
});
