import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";

import {
  branchToVersion,
  createSnapshot,
  ensureInitialVersion,
  getProjectVersionHistory,
  readVersionContent,
} from "@/lib/version-history";

async function makeTempProjectDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "quillbot-vh-"));
  return dir;
}

describe("version-history", () => {
  it("creates an initial version snapshot", async () => {
    const projectDir = await makeTempProjectDir();

    await fs.writeFile(path.join(projectDir, "draft.md"), "hello", "utf-8");

    const record = await ensureInitialVersion({
      projectDir,
      filePath: "draft.md",
      createdBy: { id: "opencode", name: "OpenCode", kind: "ai" },
      label: "Version 1",
    });

    expect(record.latestVersionId).toBeTruthy();
    expect(record.versions).toHaveLength(1);
    expect(record.versions[0].label).toBe("Version 1");

    const history = await getProjectVersionHistory(projectDir);
    expect(history.schemaVersion).toBe(1);
    expect(history.files["draft.md"]?.versions).toHaveLength(1);

    const latest = record.latestVersionId!;
    const snap = await readVersionContent({
      projectDir,
      filePath: "draft.md",
      versionId: latest,
    });
    expect(snap).toBe("hello");
  });

  it("appends snapshots and can branch (truncate future versions)", async () => {
    const projectDir = await makeTempProjectDir();
    await fs.writeFile(path.join(projectDir, "brief.md"), "v1", "utf-8");

    const initial = await ensureInitialVersion({
      projectDir,
      filePath: "brief.md",
      createdBy: { id: "opencode", name: "OpenCode", kind: "ai" },
      label: "Version 1",
    });

    const v1 = initial.latestVersionId!;

    const v2Record = await createSnapshot({
      projectDir,
      filePath: "brief.md",
      content: "v2",
      label: "Version 2",
      createdBy: { id: "u1", name: "User", kind: "user" },
    });

    expect(v2Record.versions).toHaveLength(2);
    const v2 = v2Record.latestVersionId!;

    const v3Record = await createSnapshot({
      projectDir,
      filePath: "brief.md",
      content: "v3",
      label: "Version 3",
      createdBy: { id: "u1", name: "User", kind: "user" },
    });

    expect(v3Record.versions).toHaveLength(3);
    const v3 = v3Record.latestVersionId!;

    const branched = await branchToVersion({
      projectDir,
      filePath: "brief.md",
      versionId: v1,
      actor: { id: "u1", name: "User", kind: "user" },
      restoreWorkingFile: false,
    });

    expect(branched.record.latestVersionId).toBe(v1);
    expect(branched.record.versions).toHaveLength(1);

    const v2Content = await readVersionContent({
      projectDir,
      filePath: "brief.md",
      versionId: v2,
    });
    const v3Content = await readVersionContent({
      projectDir,
      filePath: "brief.md",
      versionId: v3,
    });

    expect(v2Content).toBeNull();
    expect(v3Content).toBeNull();
  });
});
