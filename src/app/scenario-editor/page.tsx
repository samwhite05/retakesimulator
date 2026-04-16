import { notFound } from "next/navigation";
import { isScenarioEditorEnabled } from "@/lib/editorAccess";
import ScenarioEditorClient from "./ScenarioEditorClient";

export const dynamic = "force-dynamic";

export default function ScenarioEditorPage() {
  if (!isScenarioEditorEnabled()) notFound();
  return <ScenarioEditorClient />;
}
