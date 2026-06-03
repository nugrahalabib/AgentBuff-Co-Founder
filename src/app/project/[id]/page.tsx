import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/ui/app-header";
import { CredentialGate } from "@/ui/credential-gate";
import { app } from "@/server/runtime";
import { getServerUserId } from "@/server/api-helpers";
import { ProjectClient } from "./project-client";

export default async function ProjectPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const userId = await getServerUserId();
  if (userId === null) redirect("/onboarding");

  const state = await app.projects.getState(id);
  if (state === null || state.project.ownerUserId !== userId) notFound();

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-5 py-8">
        <CredentialGate feature="validasi ide & narasi business plan" />
        <ProjectClient
          projectId={state.project.id}
          title={state.project.title}
          ideaText={state.project.ideaText}
          initialResearch={state.research ?? null}
          initialPlan={state.plan ?? null}
          initialDocuments={state.documents ?? []}
        />
      </main>
    </div>
  );
}
