import type {
  Part,
  StreamEvent,
  StreamActivity,
  TextPart,
} from "@/types/opencode-events";

export type StreamEventBucket =
  | "display"
  | "activity"
  | "question"
  | "status"
  | "file"
  | "ignore";

export function isDisplayableTextPart(part: Part): part is TextPart {
  if (part.type !== "text") return false;
  const maybeSynthetic = "synthetic" in part ? Boolean(part.synthetic) : false;
  return !maybeSynthetic;
}

export function classifyStreamEvent(event: StreamEvent): StreamEventBucket {
  switch (event.type) {
    case "part":
      return isDisplayableTextPart(event.part) ? "display" : "activity";
    case "question":
      return "question";
    case "status":
      return "status";
    case "error":
    case "done":
      return "status";
    case "file.edited":
      return "file";
    case "activity":
      return "activity";
    default:
      return "ignore";
  }
}

export function createFileEditedActivity(file: string): StreamActivity {
  return {
    type: "activity",
    activityType: "file.edited",
    data: { file },
  };
}
