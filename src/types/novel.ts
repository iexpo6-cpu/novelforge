export type ChapterStatus = 'draft' | 'writing' | 'completed';

export interface Project {
  id: string;
  user_id: string;
  title: string;
  genre: string;
  logline: string;
  synopsis: string;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  project_id: string;
  order_index: number;
  title: string;
  content: string;
  summary: string;
  word_count: number;
  status: ChapterStatus;
  created_at: string;
  updated_at: string;
}

export interface CharacterCustomField {
  label: string;
  value: string;
}

export interface Character {
  id: string;
  project_id: string;
  folder: string;
  name: string;
  role: string;
  age: string;
  appearance: string;
  personality: string;
  background: string;
  relationships: string;
  custom_fields?: CharacterCustomField[];
  avatar_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorldSetting {
  id: string;
  project_id: string;
  folder: string;
  category: string;
  title: string;
  description: string;
  tags: string[];
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlotNode {
  id: string;
  project_id: string;
  folder: string;
  order_index: number;
  act_label: string;
  title: string;
  description: string;
  chapter_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ImageTargetType = 'cover' | 'character' | 'world' | 'scene';

export interface ProjectImage {
  id: string;
  project_id: string;
  target_type: ImageTargetType;
  target_id: string | null;
  prompt: string;
  image_url: string;
  storage_path: string;
  created_at: string;
}

export type AIActionType =
  | 'chat'
  | 'feedback'
  | 'polish'
  | 'continue'
  | 'brainstorm'
  | 'plan';

export interface AIChatMessage {
  id: string;
  project_id: string;
  chapter_id: string | null;
  role: 'user' | 'assistant';
  content: string;
  action_type: AIActionType;
  created_at: string;
}
