import fs from "node:fs";
import path from "node:path";
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client";

const baseUrl = process.env.OPENCODE_API_URL || "http://localhost:9090";
const apiKey = process.env.OPENCODE_API_KEY || undefined;
const projectDir = path.resolve(
  process.env.OPENCODE_CAPTURE_DIR || "./opencode-stream-sandbox",
);
const outputSsePath = path.resolve(
  process.env.OPENCODE_STREAM_SSE_PATH || "./opencode-stream-sample.sse",
);
const outputSdkPath = path.resolve(
  process.env.OPENCODE_STREAM_SDK_PATH || "./opencode-stream-sample.sdk.jsonl",
);

fs.mkdirSync(projectDir, { recursive: true });

const client = createOpencodeClient({
  baseUrl,
  directory: projectDir,
  headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
});

const timestamp = new Date().toISOString();
const sdkStream = fs.createWriteStream(outputSdkPath, { flags: "w" });
const sseStream = fs.createWriteStream(outputSsePath, { flags: "w" });

function writeSdkEvent(event) {
  const payload = {
    capturedAt: new Date().toISOString(),
    event,
  };
  sdkStream.write(`${JSON.stringify(payload)}\n`);
}

function writeSseEvent(event) {
  sseStream.write(`data: ${JSON.stringify(event)}\n\n`);
}

function transformSdkEvent(sdkEvent, targetSessionId) {
  switch (sdkEvent.type) {
    case "message.part.updated": {
      const { part, delta } = sdkEvent.properties;
      if (part.sessionID !== targetSessionId) {
        return null;
      }
      return { type: "part", part, delta };
    }

    case "question.asked": {
      const questionRequest = sdkEvent.properties;
      if (questionRequest.sessionID !== targetSessionId) {
        return null;
      }
      return {
        type: "question",
        data: {
          requestId: questionRequest.id,
          sessionId: questionRequest.sessionID,
          questions: questionRequest.questions.map((q) => ({
            question: q.question,
            header: q.header,
            options: q.options.map((opt) => ({
              label: opt.label,
              description: opt.description,
            })),
            multiple: q.multiple,
            custom: q.custom,
          })),
        },
      };
    }

    case "session.status": {
      const { sessionID, status } = sdkEvent.properties;
      if (sessionID !== targetSessionId) {
        return null;
      }
      return { type: "status", sessionStatus: status, sessionId: sessionID };
    }

    case "session.error": {
      const { sessionID, error } = sdkEvent.properties;
      if (sessionID && sessionID !== targetSessionId) {
        return null;
      }
      const errorMessage =
        error && error.data && error.data.message
          ? error.data.message
          : "Unknown error";
      return { type: "error", error: errorMessage, sessionId: sessionID };
    }

    case "session.idle": {
      const { sessionID } = sdkEvent.properties;
      if (sessionID !== targetSessionId) {
        return null;
      }
      return { type: "done", sessionId: sessionID };
    }

    case "file.edited": {
      const { file } = sdkEvent.properties;
      return { type: "file.edited", file };
    }

    case "tui.prompt.append":
      return {
        type: "activity",
        activityType: "tui.prompt.append",
        data: { text: sdkEvent.properties.text },
      };

    case "tui.command.execute":
      return {
        type: "activity",
        activityType: "tui.command.execute",
        data: { command: sdkEvent.properties.command },
      };

    case "tui.toast.show": {
      const { title, message, variant, duration } = sdkEvent.properties;
      return {
        type: "activity",
        activityType: "tui.toast.show",
        data: { title, message, variant, duration },
      };
    }

    case "command.executed": {
      const {
        name,
        arguments: args,
        sessionID,
        messageID,
      } = sdkEvent.properties;
      if (sessionID && sessionID !== targetSessionId) {
        return null;
      }
      return {
        type: "activity",
        activityType: "command.executed",
        data: { name, arguments: args },
        sessionId: sessionID,
        messageId: messageID,
      };
    }

    case "mcp.tools.changed":
      return {
        type: "activity",
        activityType: "mcp.tools.changed",
        data: { server: sdkEvent.properties.server },
      };

    case "mcp.browser.open.failed": {
      const { mcpName, url } = sdkEvent.properties;
      return {
        type: "activity",
        activityType: "mcp.browser.open.failed",
        data: { mcpName, url },
      };
    }

    case "permission.asked": {
      const permission = sdkEvent.properties;
      if (permission.sessionID !== targetSessionId) {
        return null;
      }
      return {
        type: "activity",
        activityType: "permission.asked",
        data: permission,
        sessionId: permission.sessionID,
        messageId: permission.tool?.messageID,
      };
    }

    case "permission.replied": {
      const { sessionID, requestID, reply } = sdkEvent.properties;
      if (sessionID !== targetSessionId) {
        return null;
      }
      return {
        type: "activity",
        activityType: "permission.replied",
        data: { requestID, reply },
        sessionId: sessionID,
      };
    }

    case "todo.updated": {
      const { sessionID, todos } = sdkEvent.properties;
      if (sessionID !== targetSessionId) {
        return null;
      }
      return {
        type: "activity",
        activityType: "todo.updated",
        data: { todos },
        sessionId: sessionID,
      };
    }

    default:
      return null;
  }
}

const prompt =
  "You are a debug harness for stream parsing. " +
  "Call the question tool now to ask one single-choice question with header 'Debug Check' " +
  "and options 'Proceed' and 'Stop'. " +
  "After I answer, think briefly about the next step. " +
  "Then create or edit a file named 'debug-note.md' in the project directory with content 'Stream capture OK'. " +
  "If you cannot use the question tool, reply with 'QUESTION_UNAVAILABLE'. " +
  "Finally, reply with a short confirmation.";

const sessionResult = await client.session.create({
  directory: projectDir,
  title: `Stream Capture ${timestamp}`,
});

if ("error" in sessionResult && sessionResult.error) {
  throw new Error(`Session creation failed: ${sessionResult.error}`);
}

if (!("data" in sessionResult) || !sessionResult.data) {
  throw new Error("Session creation returned no data");
}

const sessionId = sessionResult.data.id;
const eventSubscription = await client.event.subscribe();
const streamIterator = eventSubscription.stream[Symbol.asyncIterator]();

let questionAnswered = false;
const promptPromise = client.session.promptAsync({
  sessionID: sessionId,
  directory: projectDir,
  parts: [{ type: "text", text: prompt }],
});

const startedAt = Date.now();
const overallTimeoutMs = Number(
  process.env.OPENCODE_CAPTURE_TIMEOUT_MS || 120000,
);
const waitTimeoutMs = Number(process.env.OPENCODE_CAPTURE_WAIT_MS || 15000);
let completionReason = "unknown";

function abortEventStream() {
  const controller =
    eventSubscription.controller || eventSubscription.stream?.controller;
  if (controller && typeof controller.abort === "function") {
    controller.abort();
  }
}

while (true) {
  const elapsed = Date.now() - startedAt;
  if (elapsed > overallTimeoutMs) {
    console.warn("Capture timed out, aborting session.");
    completionReason = "timeout";
    await client.session.abort({ sessionID: sessionId });
    break;
  }

  const nextEvent = await Promise.race([
    streamIterator.next(),
    new Promise((resolve) =>
      setTimeout(() => resolve({ timeout: true }), waitTimeoutMs),
    ),
  ]);

  if (nextEvent && nextEvent.timeout) {
    console.warn("No events received within wait timeout.");
    continue;
  }

  if (!nextEvent || nextEvent.done) {
    break;
  }

  const sdkEvent = nextEvent.value;
  writeSdkEvent(sdkEvent);

  const streamEvent = transformSdkEvent(sdkEvent, sessionId);
  if (streamEvent) {
    writeSseEvent(streamEvent);
  }

  if (sdkEvent.type === "question.asked") {
    const { id, sessionID, questions } = sdkEvent.properties;
    if (sessionID === sessionId && !questionAnswered) {
      const answers = questions.map((question) => {
        const firstOption = question.options[0]?.label;
        return [firstOption || "Proceed"];
      });
      await client.question.reply({
        requestID: id,
        directory: projectDir,
        answers,
      });
      questionAnswered = true;
    }
  }

  if (sdkEvent.type === "session.status") {
    const { sessionID, status } = sdkEvent.properties;
    if (sessionID === sessionId && status.type === "idle") {
      completionReason = "status-idle";
      break;
    }
  }

  if (sdkEvent.type === "session.error") {
    const { sessionID } = sdkEvent.properties;
    if (!sessionID || sessionID === sessionId) {
      completionReason = "session-error";
      break;
    }
  }

  if (sdkEvent.type === "session.idle") {
    const { sessionID } = sdkEvent.properties;
    if (sessionID === sessionId) {
      completionReason = "session-idle";
      break;
    }
  }
}

abortEventStream();

const promptResult = await Promise.race([
  promptPromise.then(() => "complete"),
  new Promise((resolve) => setTimeout(() => resolve("timeout"), 5000)),
]);

if (promptResult === "timeout") {
  console.warn("Prompt completion timed out; exiting after stream close.");
}

await Promise.all([
  new Promise((resolve) => sdkStream.end(resolve)),
  new Promise((resolve) => sseStream.end(resolve)),
]);

console.log("Captured stream to:");
console.log(`- ${outputSsePath}`);
console.log(`- ${outputSdkPath}`);
console.log(`Completion reason: ${completionReason}`);
