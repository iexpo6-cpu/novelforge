import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import DashboardClient from '@/components/dashboard/DashboardClient';
import type { Project } from '@/types/novel';

async function DashboardContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  return (
    <DashboardClient
      userEmail={user.email ?? '작가'}
      initialProjects={(projects as Project[]) ?? []}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-stone-50 text-sm text-stone-500">
          프로젝트 목록을 불러오는 중...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
