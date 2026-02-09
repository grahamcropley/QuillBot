"use client";

import { useState, useMemo, useCallback } from "react";

import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  Plus,
  FileText,
  Trash2,
  Search,
  X,
  LayoutGrid,
  List,
  ArrowUpDown,
  PenLine,
  BookOpen,
  Share2,
  Mail,
  Clock,
  Calendar,
  User,
} from "lucide-react";
import { Card, CardContent, Button, Input, Modal } from "@/components/ui";
import type { Project, ContentType } from "@/types";
import { clsx } from "clsx";

type SortOption = "newest" | "oldest" | "a-z" | "z-a" | "recently-updated";
type ViewMode = "grid" | "list";
type CategoryFilter = "all" | ContentType;

interface ProjectSelectorProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onCreateNew: () => void;
  onReviewExisting: () => void;
  onDeleteProject: (id: string) => void;
  isLoading?: boolean;
}

const CONTENT_TYPE_CONFIG: Record<
  ContentType,
  {
    label: string;
    pluralLabel: string;
    icon: typeof FileText;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  blog: {
    label: "Blog",
    pluralLabel: "Blogs",
    icon: PenLine,
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  "white-paper": {
    label: "White Paper",
    pluralLabel: "White Papers",
    icon: BookOpen,
    color: "text-purple-700 dark:text-purple-300",
    bgColor: "bg-purple-50 dark:bg-purple-950/50",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  "social-post": {
    label: "Social Post",
    pluralLabel: "Social Posts",
    icon: Share2,
    color: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
    borderColor: "border-emerald-200 dark:border-emerald-800",
  },
  email: {
    label: "Email",
    pluralLabel: "Emails",
    icon: Mail,
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-50 dark:bg-amber-950/50",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  "case-study": {
    label: "Case Study",
    pluralLabel: "Case Studies",
    icon: BookOpen,
    color: "text-cyan-700 dark:text-cyan-300",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/50",
    borderColor: "border-cyan-200 dark:border-cyan-800",
  },
  "landing-page": {
    label: "Landing Page",
    pluralLabel: "Landing Pages",
    icon: LayoutGrid,
    color: "text-rose-700 dark:text-rose-300",
    bgColor: "bg-rose-50 dark:bg-rose-950/50",
    borderColor: "border-rose-200 dark:border-rose-800",
  },
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recently-updated", label: "Recently Updated" },
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "a-z", label: "Name A-Z" },
  { value: "z-a", label: "Name Z-A" },
];

const SKELETON_KEYS = [
  "skeleton-1",
  "skeleton-2",
  "skeleton-3",
  "skeleton-4",
  "skeleton-5",
  "skeleton-6",
];

function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "Unknown";

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateObj);
}

function formatDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dateObj);
}

function sortProjects(projects: Project[], sort: SortOption): Project[] {
  return [...projects].sort((a, b) => {
    switch (sort) {
      case "newest":
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case "oldest":
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      case "a-z":
        return a.name.localeCompare(b.name);
      case "z-a":
        return b.name.localeCompare(a.name);
      case "recently-updated":
      default:
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    }
  });
}

interface ContentTypeBadgeProps {
  contentType: ContentType;
  size?: "sm" | "md";
}

function ContentTypeBadge({ contentType, size = "sm" }: ContentTypeBadgeProps) {
  const config = CONTENT_TYPE_CONFIG[contentType];
  const Icon = config.icon;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full font-medium border",
        config.color,
        config.bgColor,
        config.borderColor,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
      )}
    >
      <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {config.label}
    </span>
  );
}

interface CategoryTabsProps {
  activeCategory: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  categoryCounts: Record<CategoryFilter, number>;
}

function CategoryTabs({
  activeCategory,
  onCategoryChange,
  categoryCounts,
}: CategoryTabsProps) {
  const categories: { key: CategoryFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "blog", label: "Blogs" },
    { key: "case-study", label: "Case Studies" },
    { key: "landing-page", label: "Landing Pages" },
    { key: "social-post", label: "Social" },
    { key: "email", label: "Emails" },
    { key: "white-paper", label: "White Papers" },
  ];

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 -mb-px scrollbar-none">
      {categories.map(({ key, label }) => {
        const count = categoryCounts[key];
        const isActive = activeCategory === key;
        const hasItems = count > 0;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onCategoryChange(key)}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors",
              isActive
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                : hasItems
                  ? "text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800/50"
                  : "text-gray-400 hover:text-gray-500 hover:bg-gray-50 dark:text-gray-600 dark:hover:text-gray-500 dark:hover:bg-gray-800/50",
            )}
          >
            {label}
            <span
              className={clsx(
                "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-medium",
                isActive
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                  : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface ProjectGridCardProps {
  project: Project;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (projectId: string, projectName: string) => void;
}

function ProjectGridCard({
  project,
  isSelected,
  onSelect,
  onDelete,
}: ProjectGridCardProps) {
  return (
    <Card
      onClick={onSelect}
      isSelected={isSelected}
      className="hover:border-blue-300 dark:hover:border-blue-700 transition-all group relative"
    >
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="w-24 flex justify-center flex-shrink-0">
            <ContentTypeBadge contentType={project.contentType} />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(project.id, project.name);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
            aria-label={`Delete ${project.name}`}
          >
            <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
          </button>
        </div>

        <h3 className="font-semibold text-gray-900 dark:text-gray-50 truncate leading-tight">
          {project.name}
        </h3>

        {project.brief ? (
          <p
            className="text-sm text-gray-500 dark:text-gray-400"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {project.brief}
          </p>
        ) : null}

        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(project.updatedAt)}
          </span>
          {project.lastModifiedByName && (
            <span className="inline-flex items-center gap-1 truncate max-w-[160px]">
              <User className="w-3 h-3" />
              {project.lastModifiedByName}
            </span>
          )}
          {project.wordCount > 0 && (
            <span className="text-gray-300 dark:text-gray-600">
              ~{project.wordCount.toLocaleString()} words
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ProjectListRowProps {
  project: Project;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (projectId: string, projectName: string) => void;
}

function ProjectListRow({
  project,
  isSelected,
  onSelect,
  onDelete,
}: ProjectListRowProps) {
  const config = CONTENT_TYPE_CONFIG[project.contentType];
  const Icon = config.icon;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={clsx(
        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors group rounded-lg border cursor-pointer",
        isSelected
          ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
          : "bg-white border-gray-100 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-800 dark:hover:bg-gray-800/50",
      )}
    >
      <div className={clsx("p-1.5 rounded-md flex-shrink-0", config.bgColor)}>
        <Icon className={clsx("w-4 h-4", config.color)} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-900 dark:text-gray-50 truncate">
          {project.name}
        </p>
        {project.brief ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {project.brief}
          </p>
        ) : null}
      </div>

      <ContentTypeBadge contentType={project.contentType} />

      {project.wordCount > 0 && (
        <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 w-20 text-right flex-shrink-0">
          ~{project.wordCount.toLocaleString()} words
        </span>
      )}

      <span className="text-xs text-gray-400 dark:text-gray-500 w-20 text-right flex-shrink-0 hidden sm:inline-flex items-center gap-1">
        <Clock className="w-3 h-3" />
        {formatRelativeTime(project.updatedAt)}
      </span>

      <span
        className="text-xs text-gray-400 dark:text-gray-500 w-32 text-right flex-shrink-0 hidden md:inline-flex items-center gap-1 justify-end truncate"
        title={
          project.lastModifiedByName
            ? `Last modified by ${project.lastModifiedByName}`
            : undefined
        }
      >
        <User className="w-3 h-3" />
        {project.lastModifiedByName ?? "Unknown"}
      </span>

      <span className="text-xs text-gray-400 dark:text-gray-500 w-28 text-right flex-shrink-0 hidden lg:inline-flex items-center gap-1 justify-end">
        <Calendar className="w-3 h-3" />
        {formatRelativeTime(project.createdAt)}
      </span>

      <span
        className="text-xs text-gray-400 dark:text-gray-500 w-32 text-right flex-shrink-0 hidden lg:inline-flex items-center gap-1 justify-end truncate"
        title={
          project.createdByName
            ? `Created by ${project.createdByName}`
            : undefined
        }
      >
        <User className="w-3 h-3" />
        {project.createdByName ?? "Unknown"}
      </span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(project.id, project.name);
        }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg flex-shrink-0"
        aria-label={`Delete ${project.name}`}
      >
        <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
      </button>
    </div>
  );
}

export function ProjectSelector({
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateNew,
  onReviewExisting,
  onDeleteProject,
  isLoading,
}: ProjectSelectorProps) {
  const [searchTerm, setSearchTerm] = useLocalStorage<string>(
    "quillbot:search",
    "",
  );
  const [sortBy, setSortBy] = useLocalStorage<SortOption>(
    "quillbot:sort",
    "recently-updated",
  );
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>(
    "quillbot:view",
    "grid",
  );
  const [activeCategory, setActiveCategory] = useLocalStorage<CategoryFilter>(
    "quillbot:category",
    "all",
  );
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    projectId: string | null;
    projectName: string | null;
  }>({
    isOpen: false,
    projectId: null,
    projectName: null,
  });

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: projects.length,
      blog: 0,
      "white-paper": 0,
      "social-post": 0,
      email: 0,
      "case-study": 0,
      "landing-page": 0,
    };
    for (const p of projects) {
      counts[p.contentType] = (counts[p.contentType] || 0) + 1;
    }
    return counts;
  }, [projects]);

  const displayProjects = useMemo(() => {
    let filtered = projects;

    if (activeCategory !== "all") {
      filtered = filtered.filter((p) => p.contentType === activeCategory);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.contentType.toLowerCase().includes(term) ||
          p.brief?.toLowerCase().includes(term),
      );
    }

    return sortProjects(filtered, sortBy);
  }, [projects, activeCategory, searchTerm, sortBy]);

  const handleDeleteClick = useCallback(
    (projectId: string, projectName: string) => {
      setDeleteModal({ isOpen: true, projectId, projectName });
    },
    [],
  );

  const handleConfirmDelete = useCallback(() => {
    if (deleteModal.projectId) {
      onDeleteProject(deleteModal.projectId);
      setDeleteModal({ isOpen: false, projectId: null, projectName: null });
    }
  }, [deleteModal.projectId, onDeleteProject]);

  const handleCloseModal = useCallback(() => {
    setDeleteModal({ isOpen: false, projectId: null, projectName: null });
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-7 w-40 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
          <div className="h-9 w-32 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
        </div>
        <div className="h-10 w-full bg-gray-100 dark:bg-gray-900 rounded-lg animate-pulse" />
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {SKELETON_KEYS.map((key) => (
            <div
              key={key}
              className="h-28 bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Your Projects
          </h2>
        </div>
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-950 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
          <FileText className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
          <h3 className="text-gray-700 dark:text-gray-300 font-semibold text-lg">
            No projects yet
          </h3>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1 max-w-xs mx-auto">
            Create your first content project to get started with AI-powered
            authoring.
          </p>
          <div className="flex gap-2">
            <Button onClick={onCreateNew} className="mt-6 flex-1">
              <Plus className="w-4 h-4 mr-1.5" />
              Create New
            </Button>
            <Button
              onClick={onReviewExisting}
              className="mt-6 flex-1"
              variant="ghost"
            >
              <FileText className="w-4 h-4 mr-1.5" />
              Review Existing
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          Your Projects
        </h2>
        <div className="flex gap-2">
          <Button onClick={onCreateNew} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Create New
          </Button>
          <Button onClick={onReviewExisting} size="sm" variant="ghost">
            <FileText className="w-4 h-4 mr-1" />
            Review Existing
          </Button>
        </div>
      </div>

      <CategoryTabs
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        categoryCounts={categoryCounts}
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name or brief..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="relative flex-shrink-0">
          <label htmlFor="sort-select" className="sr-only">
            Sort projects
          </label>
          <ArrowUpDown className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className={clsx(
              "appearance-none pl-8 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg",
              "bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              "cursor-pointer",
            )}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-shrink-0 flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={clsx(
              "p-2 transition-colors",
              viewMode === "grid"
                ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:text-gray-300 dark:hover:bg-gray-800/50",
            )}
            aria-label="Grid view"
            aria-pressed={viewMode === "grid"}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-gray-300 dark:bg-gray-600" />
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={clsx(
              "p-2 transition-colors",
              viewMode === "list"
                ? "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:text-gray-300 dark:hover:bg-gray-800/50",
            )}
            aria-label="List view"
            aria-pressed={viewMode === "list"}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {(searchTerm || activeCategory !== "all") && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {displayProjects.length}{" "}
          {displayProjects.length === 1 ? "project" : "projects"}
          {activeCategory !== "all" && (
            <>
              {" "}
              in{" "}
              <span className="font-medium text-gray-500 dark:text-gray-400">
                {CONTENT_TYPE_CONFIG[activeCategory].pluralLabel}
              </span>
            </>
          )}
          {searchTerm && (
            <>
              {" "}
              matching{" "}
              <span className="font-medium text-gray-500 dark:text-gray-400">
                &ldquo;{searchTerm}&rdquo;
              </span>
            </>
          )}
        </p>
      )}

      {displayProjects.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-950 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
          <Search className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <h3 className="text-gray-600 dark:text-gray-400 font-medium">
            No projects found
          </h3>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            {searchTerm
              ? "Try adjusting your search or clearing filters"
              : `No ${activeCategory !== "all" ? CONTENT_TYPE_CONFIG[activeCategory].pluralLabel.toLowerCase() : "projects"} yet`}
          </p>
          {(searchTerm || activeCategory !== "all") && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm("")}
                >
                  Clear search
                </Button>
              )}
              {activeCategory !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveCategory("all")}
                >
                  Show all
                </Button>
              )}
            </div>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {displayProjects.map((project) => (
            <ProjectGridCard
              key={project.id}
              project={project}
              isSelected={project.id === selectedProjectId}
              onSelect={() => onSelectProject(project.id)}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="hidden sm:flex items-center gap-3 px-4 py-2 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            <span className="w-8" />
            <span className="flex-1 min-w-0">Name</span>
            <span className="w-24 text-center">Type</span>
            <span className="w-20 text-right">Words</span>
            <span className="w-20 text-right">Updated</span>
            <span className="hidden md:inline w-32 text-right">
              Modified By
            </span>
            <span className="hidden lg:inline w-28 text-right">Created</span>
            <span className="hidden lg:inline w-32 text-right">Created By</span>
            <span className="w-8" />
          </div>
          {displayProjects.map((project) => (
            <ProjectListRow
              key={project.id}
              project={project}
              isSelected={project.id === selectedProjectId}
              onSelect={() => onSelectProject(project.id)}
              onDelete={handleDeleteClick}
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
