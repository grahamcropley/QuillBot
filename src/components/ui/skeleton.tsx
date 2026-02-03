import { clsx } from "clsx";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({
  className,
  variant = "text",
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  const baseStyles = "animate-pulse bg-gray-200 rounded";

  const variantStyles = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  const style = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  if (lines > 1) {
    return (
      <div className={clsx("space-y-2", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={clsx(baseStyles, variantStyles[variant])}
            style={{
              ...style,
              width: i === lines - 1 ? "75%" : style.width,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={clsx(baseStyles, variantStyles[variant], className)}
      style={style}
    />
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="p-4 border border-gray-200 rounded-lg space-y-3">
      <Skeleton variant="text" width="60%" height={20} />
      <Skeleton variant="text" width="40%" height={16} />
      <div className="flex gap-2 pt-2">
        <Skeleton variant="rectangular" width={60} height={24} />
        <Skeleton variant="rectangular" width={80} height={24} />
      </div>
    </div>
  );
}

export function ConversationSkeleton() {
  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div className="flex gap-3">
        <Skeleton variant="circular" width={32} height={32} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="60%" />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <div className="flex-1 space-y-2 max-w-[70%]">
          <Skeleton variant="text" width="90%" />
          <Skeleton variant="text" width="70%" />
        </div>
        <Skeleton variant="circular" width={32} height={32} />
      </div>
      <div className="flex gap-3">
        <Skeleton variant="circular" width={32} height={32} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="85%" />
          <Skeleton variant="text" width="55%" />
          <Skeleton variant="text" width="65%" />
        </div>
      </div>
    </div>
  );
}

export function PreviewSkeleton() {
  return (
    <div className="h-full border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex justify-between">
        <Skeleton variant="rectangular" width={120} height={28} />
        <Skeleton variant="circular" width={28} height={28} />
      </div>
      <div className="p-6 space-y-4">
        <Skeleton variant="text" width="40%" height={28} />
        <Skeleton variant="text" lines={3} />
        <Skeleton variant="text" width="50%" height={24} />
        <Skeleton variant="text" lines={4} />
        <Skeleton variant="text" width="35%" height={24} />
        <Skeleton variant="text" lines={2} />
      </div>
    </div>
  );
}

export function AnalysisSkeleton() {
  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-4">
      <Skeleton variant="text" width="50%" height={20} />
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton variant="text" width={80} />
          <Skeleton variant="text" width={40} />
        </div>
        <Skeleton variant="rectangular" width="100%" height={8} />
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton variant="text" width={100} />
          <Skeleton variant="text" width={50} />
        </div>
        <Skeleton variant="rectangular" width="100%" height={8} />
      </div>
      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="space-y-1">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" height={24} />
        </div>
        <div className="space-y-1">
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="50%" height={24} />
        </div>
      </div>
    </div>
  );
}
