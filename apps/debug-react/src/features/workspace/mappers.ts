import type { LanhuParams } from "@/api/parse-url";
import type { ServerParams } from "@/api/types";

export function mapServerParams(serverParams: ServerParams): LanhuParams {
  return {
    team_id: serverParams.teamId ?? null,
    project_id: serverParams.projectId,
    doc_id: serverParams.docId ?? serverParams.imageId ?? null,
    version_id: serverParams.versionId ?? null,
  };
}
