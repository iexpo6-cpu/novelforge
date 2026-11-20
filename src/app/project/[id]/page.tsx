import { Suspense } from 'react';
import { redirect, notFound } from 'next/navigation';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import StudioShell from '@/components/studio/StudioShell';
import type {
  AIChatMessage,
  Chapter,
  Character,
  PlotNode,
  Project,
  ProjectImage,
  WorldSetting,
} from '@/types/novel';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function ProjectStudioContent({ params }: PageProps) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [
    { data: project },
    { data: chapters },
    { data: characters },
    { data: worldSettings },
    { data: plotNodes },
    { data: images },
    { data: chatMessages },
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase
      .from('chapters')
      .select('*')
      .eq('project_id', id)
      .order('order_index', { ascending: true }),
    supabase
      .from('characters')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('world_settings')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('plot_nodes')
      .select('*')
      .eq('project_id', id)
      .order('order_index', { ascending: true }),
    supabase
      .from('project_images')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true })
      .limit(60),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <StudioShell
      initialProject={project as Project}
      initialChapters={(chapters as Chapter[]) ?? []}
      initialCharacters={(characters as Character[]) ?? []}
      initialWorldSettings={(worldSettings as WorldSetting[]) ?? []}
      initialPlotNodes={(plotNodes as PlotNode[]) ?? []}
      initialImages={(images as ProjectImage[]) ?? []}
      initialMessages={(chatMessages as AIChatMessage[]) ?? []}
    />
  );
}

export default function ProjectStudioPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-stone-50 text-sm text-stone-500">
          소설 스튜디오를 여는 중...
        </div>
      }
    >
      <ProjectStudioContent params={params} />
    </Suspense>
  );
}
