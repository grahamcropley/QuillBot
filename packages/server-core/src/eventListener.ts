import type { Event as OcEvent } from "@opencode-ai/sdk/v2";
import { opencode } from "./opencode";
import {
  upsertMessage,
  removeMessage,
  upsertPart,
  removePart,
  setSessionStatus,
  updateSessionInfo,
  getTrackedSession,
  setQuestion,
  clearQuestion,
} from "./sessionStore";

const runningListeners = new Set<string>();

function listenerKey(directory?: string): string {
  return directory?.trim() || "__default__";
}

function handleEvent(event: OcEvent): void {
  switch (event.type) {
    case "message.updated": {
      const { info } = event.properties;
      upsertMessage(info.sessionID, info);
      break;
    }
    case "message.removed": {
      const { sessionID, messageID } = event.properties;
      removeMessage(sessionID, messageID);
      break;
    }
    case "message.part.updated": {
      const { part } = event.properties;
      upsertPart(part.sessionID, part);
      break;
    }
    case "message.part.removed": {
      const { sessionID, messageID, partID } = event.properties;
      removePart(sessionID, messageID, partID);
      break;
    }
    case "session.status": {
      const { sessionID, status } = event.properties;
      setSessionStatus(sessionID, status);
      break;
    }
    case "session.updated": {
      const { info } = event.properties;
      updateSessionInfo(info);
      break;
    }
    case "question.asked": {
      const request = event.properties;
      setQuestion(request.sessionID, request);
      break;
    }
    case "question.replied":
    case "question.rejected": {
      const { sessionID } = event.properties;
      clearQuestion(sessionID);
      break;
    }
    default:
      break;
  }
}

export async function ensureEventListener(directory?: string): Promise<void> {
  const key = listenerKey(directory);
  if (runningListeners.has(key)) return;
  runningListeners.add(key);

  try {
    const result = await opencode.event.subscribe(
      directory ? { directory } : undefined,
    );
    const stream = result.stream;

    (async () => {
      try {
        for await (const event of stream) {
          const ocEvent = event as OcEvent;
          const sessionId =
            "sessionID" in ocEvent.properties
              ? (ocEvent.properties as { sessionID?: string }).sessionID
              : undefined;

          if (sessionId && !getTrackedSession(sessionId)) {
            continue;
          }

          handleEvent(ocEvent);
        }
      } catch (err) {
        console.error("[eventListener] SSE stream error:", err);
      } finally {
        runningListeners.delete(key);
      }
    })();
  } catch (err) {
    runningListeners.delete(key);
    console.error("[eventListener] Failed to connect to OpenCode SSE:", err);
  }
}
