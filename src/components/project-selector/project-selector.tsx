"use client";

import { useState } from "react";
import { Plus, FileText, Trash2, Search, X } from "lucide-react";
import { Card, CardContent, Button, Input, Modal } from "@/components/ui";
import type { Project } from "@/types";

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
  onDelete: (
    e: React.MouseEvent,
    projectId: string,
    projectName: string,
  ) => void;
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
          <h3 className="font-medium text-gray-900 dark:text-gray-50 truncate">
            {project.name}
          </h3>
          <p className="text-sm text-gray-500 capitalize">
            {project.contentType.replace("-", " ")}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {formatDate(project.updatedAt)}
          </p>
        </div>
        <button
          onClick={(e) => onDelete(e, project.id, project.name)}
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
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    projectId: string | null;
    projectName: string | null;
  }>({
    isOpen: false,
    projectId: null,
    projectName: null,
  });

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleDeleteClick = (projectId: string, projectName: string) => {
    setDeleteModal({
      isOpen: true,
      projectId,
      projectName,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteModal.projectId) {
      onDeleteProject(deleteModal.projectId);
      setDeleteModal({
        isOpen: false,
        projectId: null,
        projectName: null,
      });
    }
  };

  const handleCloseModal = () => {
    setDeleteModal({
      isOpen: false,
      projectId: null,
      projectName: null,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Your Projects
        </h2>
        <Button onClick={onCreateNew} size="sm" disabled={isLoading}>
          <Plus className="w-4 h-4 mr-1" />
          New Project
        </Button>
      </div>

      {projects.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-950 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          <FileText className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-gray-600 dark:text-gray-400 font-medium">
            No projects yet
          </h3>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            Create your first project to get started
          </p>
          <Button onClick={onCreateNew} className="mt-4" disabled={isLoading}>
            <Plus className="w-4 h-4 mr-1" />
            Create Project
          </Button>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-950 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          <FileText className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-gray-600 dark:text-gray-400 font-medium">
            No projects found
          </h3>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            Try adjusting your search
          </p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isSelected={project.id === selectedProjectId}
              onSelect={() => onSelectProject(project.id)}
              onDelete={(e, projectId, projectName) => {
                e.stopPropagation();
                handleDeleteClick(projectId, projectName);
              }}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={deleteModal.isOpen}
        title="Delete Project"
        description={`Are you sure you want to delete "${deleteModal.projectName}"? This action cannot be undone.`}
        onClose={handleCloseModal}
        onConfirm={handleConfirmDelete}
        confirmText="Delete"
        confirmVariant="danger"
        cancelText="Cancel"
      />
    </div>
  );
}
