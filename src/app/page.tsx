"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProjectSelector } from "@/components/project-selector";
import { StarterForm } from "@/components/starter-form";
import { ReviewExistingForm } from "@/components/review-existing-form";
import { Card, CardHeader, CardContent, Input, Button } from "@/components/ui";
import { useProjectStore } from "@/stores/project-store";
import type { StarterFormData } from "@/types";

type PageMode = "select" | "create" | "review";

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

  const handleReviewExisting = useCallback(() => {
    setMode("review");
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

  const handleReviewFormSubmit = useCallback(
    async (reviewData: { markdown: string; filename: string }) => {
      setIsSubmitting(true);
      try {
        const baseName =
          reviewData.filename.replace(/\.[^.]+$/, "").trim() ||
          "Imported draft";

        const formData: StarterFormData = {
          contentType: "blog",
          wordCount: 500,
          styleHints: "",
          brief: reviewData.markdown,
        };

        const projectId = await createProject(
          baseName,
          formData,
          true,
          reviewData.filename,
        );
        router.push(`/project/${projectId}`);
      } finally {
        setIsSubmitting(false);
      }
    },
    [createProject, router],
  );

  if (mode === "create" || mode === "review") {
    const title =
      mode === "create" ? "Create New Project File" : "Review Existing Content";

    return (
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
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
              {mode === "create" ? (
                <>
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
                </>
              ) : (
                <ReviewExistingForm
                  onSubmit={handleReviewFormSubmit}
                  onCancel={() => setMode("select")}
                  isLoading={isSubmitting}
                />
              )}
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
        onReviewExisting={handleReviewExisting}
        onDeleteProject={handleDeleteProject}
        isLoading={isLoading || !isHydrated}
      />
    </div>
  );
}
