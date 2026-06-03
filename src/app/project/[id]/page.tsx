import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/ui/app-header";
import { app } from "@/server/runtime";
import { SESSION_COOKIE, verifySession } from "@/server/session";
import { ProjectClient } from "./project-client";

export default async function ProjectPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const userId = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (userId === null) redirect("/onboarding");

  const state = await app.projects.getState(id);
  if (state === null || state.project.ownerUserId !== userId) notFound();

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <ProjectClient
          projectId={state.project.id}
          title={state.project.title}
          ideaText={state.project.ideaText}
          initialResearch={state.research ?? null}
          initialPlan={state.plan ?? null}
        />
      </main>
    </div>
  );
}
