"use client";

import { Plus, FileText, Trash2 } from "lucide-react";
import { Card, CardContent, Button } from "@/components/ui";
import type { Project } from "@/types";
import { clsx } from "clsx";

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onCreateNew: () => void;
  onDeleteProject: (id: string) => void;
  isLoading?: boolean;
}

interface ProjectCardProps {
  project: Project;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function formatDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dateObj);
}

function ProjectCard({
  project,
  isSelected,
  onSelect,
  onDelete,
}: ProjectCardProps) {
  return (
    <Card
      onClick={onSelect}
      isSelected={isSelected}
      className="hover:border-blue-300 transition-colors group relative"
    >
      <CardContent className="flex items-start gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <FileText className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{project.name}</h3>
          <p className="text-sm text-gray-500 capitalize">
            {project.contentType.replace("-", " ")}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {formatDate(project.updatedAt)}
          </p>
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-lg"
          aria-label="Delete project"
        >
          <Trash2 className="w-4 h-4 text-red-600" />
        </button>
      </CardContent>
    </Card>
  );
}

export function ProjectSelector({
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateNew,
  onDeleteProject,
  isLoading,
}: ProjectSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Your Projects</h2>
        <Button onClick={onCreateNew} size="sm" disabled={isLoading}>
          <Plus className="w-4 h-4 mr-1" />
          New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-gray-600 font-medium">No projects yet</h3>
          <p className="text-gray-400 text-sm mt-1">
            Create your first project to get started
          </p>
          <Button onClick={onCreateNew} className="mt-4" disabled={isLoading}>
            <Plus className="w-4 h-4 mr-1" />
            Create Project
          </Button>
        </div>
      ) : (
        <div
          className={clsx(
            "grid gap-3",
            projects.length === 1
              ? "grid-cols-1"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isSelected={project.id === selectedProjectId}
              onSelect={() => onSelectProject(project.id)}
              onDelete={(e) => {
                e.stopPropagation();
                onDeleteProject(project.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
