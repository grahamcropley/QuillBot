"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProjectSelector } from "@/components/project-selector";
import { StarterForm } from "@/components/starter-form";
import { Card, CardHeader, CardContent, Input, Button } from "@/components/ui";
import { useProjectStore } from "@/stores/project-store";
import type { StarterFormData } from "@/types";

type PageMode = "select" | "create";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<PageMode>("select");
  const [projectName, setProjectName] = useState("");
  const [nameError, setNameError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const projects = useProjectStore((state) => state.projects);
  const currentProjectId = useProjectStore((state) => state.currentProjectId);
  const isLoading = useProjectStore((state) => state.isLoading);
  const isHydrated = useProjectStore((state) => state.isHydrated);
  const selectProject = useProjectStore((state) => state.selectProject);
  const createProject = useProjectStore((state) => state.createProject);
  const fetchProjects = useProjectStore((state) => state.fetchProjects);
  const deleteProject = useProjectStore((state) => state.deleteProject);

  useEffect(() => {
    if (!isHydrated) {
      fetchProjects();
    }
  }, [isHydrated, fetchProjects]);

  const handleSelectProject = useCallback(
    (id: string) => {
      selectProject(id);
      router.push(`/project/${id}`);
    },
    [selectProject, router],
  );

  const handleCreateNew = useCallback(() => {
    setMode("create");
    setProjectName("");
    setNameError("");
  }, []);

  const handleDeleteProject = useCallback(
    async (id: string) => {
      await deleteProject(id);
    },
    [deleteProject],
  );

  const handleFormSubmit = useCallback(
    async (formData: StarterFormData) => {
      if (!projectName.trim()) {
        setNameError("Project name is required");
        return;
      }

      setIsSubmitting(true);
      try {
        const projectId = await createProject(projectName.trim(), formData);
        router.push(`/project/${projectId}`);
      } finally {
        setIsSubmitting(false);
      }
    },
    [projectName, createProject, router],
  );

  if (mode === "create") {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Create New Project File
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode("select")}
                >
                  ← Back
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Input
                label="Project Name"
                placeholder="e.g., Q1 Product Launch Blog"
                value={projectName}
                onChange={(e) => {
                  setProjectName(e.target.value);
                  setNameError("");
                }}
                error={nameError}
              />
              <StarterForm
                onSubmit={handleFormSubmit}
                isLoading={isSubmitting}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4">
      <ProjectSelector
        projects={projects}
        selectedProjectId={currentProjectId}
        onSelectProject={handleSelectProject}
        onCreateNew={handleCreateNew}
        onDeleteProject={handleDeleteProject}
        isLoading={isLoading || !isHydrated}
      />
    </div>
  );
}
