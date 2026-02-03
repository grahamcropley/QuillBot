"use client";

import { useState, useCallback } from "react";
import { clsx } from "clsx";
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui";
import { QuestionPrompt } from "@/components/conversation/question-prompt";
import type { QuestionData, QuestionInfo, Message } from "@/types";

const MOCK_QUESTIONS: QuestionInfo[] = [
  {
    header: "Content Style",
    question: "What tone would you like for the content?",
    options: [
      {
        label: "Professional",
        description: "Formal, business-appropriate language",
      },
      { label: "Conversational", description: "Friendly, approachable tone" },
      { label: "Technical", description: "Detailed, specification-focused" },
      { label: "Marketing", description: "Persuasive, benefit-oriented" },
    ],
    multiple: false,
    custom: true,
  },
  {
    header: "Target Audience",
    question: "Who is the primary audience for this content?",
    options: [
      {
        label: "Developers",
        description: "Technical audience familiar with code",
      },
      {
        label: "Business Leaders",
        description: "Decision makers and executives",
      },
      { label: "End Users", description: "Non-technical product users" },
      {
        label: "Mixed",
        description: "Broad audience with varying technical levels",
      },
    ],
    multiple: true,
    custom: true,
  },
];

type TestScenario = {
  id: string;
  name: string;
  description: string;
  questions: QuestionInfo[];
};

const TEST_SCENARIOS: TestScenario[] = [
  {
    id: "single-choice",
    name: "Single Choice Question",
    description: "Test single selection with radio buttons",
    questions: [MOCK_QUESTIONS[0]],
  },
  {
    id: "multi-choice",
    name: "Multiple Choice Question",
    description: "Test multiple selection with checkboxes",
    questions: [MOCK_QUESTIONS[1]],
  },
  {
    id: "combined",
    name: "Combined Questions",
    description: "Test multiple questions in one prompt",
    questions: MOCK_QUESTIONS,
  },
];

type FlowStatus =
  | "idle"
  | "connecting"
  | "waiting"
  | "processing"
  | "complete"
  | "error";

interface StatusLineProps {
  status: FlowStatus;
  message?: string;
}

function StatusLine({ status, message }: StatusLineProps) {
  const statusConfig = {
    idle: { icon: null, text: "Ready", color: "text-gray-400" },
    connecting: {
      icon: Loader2,
      text: "Connecting to OpenCode...",
      color: "text-blue-600",
    },
    waiting: {
      icon: MessageSquare,
      text: "Waiting for your response...",
      color: "text-amber-600",
    },
    processing: {
      icon: Loader2,
      text: "Processing...",
      color: "text-blue-600",
    },
    complete: { icon: CheckCircle2, text: "Complete", color: "text-green-600" },
    error: {
      icon: XCircle,
      text: message || "Error occurred",
      color: "text-red-600",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={clsx(
        "flex items-center gap-2 px-4 py-2 rounded-lg border",
        status === "idle" && "bg-gray-50 border-gray-200",
        status === "connecting" && "bg-blue-50 border-blue-200",
        status === "waiting" && "bg-amber-50 border-amber-200",
        status === "processing" && "bg-blue-50 border-blue-200",
        status === "complete" && "bg-green-50 border-green-200",
        status === "error" && "bg-red-50 border-red-200",
      )}
    >
      {Icon && (
        <Icon
          className={clsx(
            "w-4 h-4",
            config.color,
            (status === "connecting" || status === "processing") &&
              "animate-spin",
          )}
        />
      )}
      <span className={clsx("text-sm font-medium", config.color)}>
        {message || config.text}
      </span>
    </div>
  );
}

interface MessageDisplayProps {
  messages: Message[];
  onAnswerQuestion?: (questionId: string, answers: string[][]) => void;
}

function MessageDisplay({ messages, onAnswerQuestion }: MessageDisplayProps) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400">
        <p>No messages yet. Select a test scenario to begin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        if (message.role === "question" && message.questionData) {
          return (
            <QuestionPrompt
              key={message.id}
              questionData={message.questionData}
              onSubmit={(answers) => onAnswerQuestion?.(message.id, answers)}
            />
          );
        }

        return (
          <div
            key={message.id}
            className={clsx(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={clsx(
                "max-w-[80%] px-4 py-2 rounded-2xl",
                message.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "bg-gray-100 text-gray-900 rounded-bl-md",
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface AnswerLogEntry {
  questionId: string;
  answers: string[][];
  timestamp: Date;
}

interface AnswerLogProps {
  entries: AnswerLogEntry[];
}

function AnswerLog({ entries }: AnswerLogProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-gray-900">Answer Log</h3>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.map((entry, index) => (
          <div
            key={index}
            className="p-3 bg-gray-50 rounded-lg text-sm font-mono"
          >
            <div className="text-gray-500 text-xs mb-1">
              {entry.timestamp.toLocaleTimeString()}
            </div>
            <pre className="text-gray-900 overflow-x-auto">
              {JSON.stringify(entry.answers, null, 2)}
            </pre>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMessage(
  role: Message["role"],
  content: string,
  questionData?: QuestionData,
): Message {
  return {
    id: `msg_${role}_${Date.now()}`,
    role,
    content,
    timestamp: new Date(),
    questionData,
  };
}

export default function QuestionTestPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<FlowStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [answerLog, setAnswerLog] = useState<AnswerLogEntry[]>([]);
  const [currentScenario, setCurrentScenario] = useState<TestScenario | null>(
    null,
  );

  const appendMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const markQuestionAsAnswered = useCallback(
    (questionId: string, answers: string[][]) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === questionId && msg.questionData) {
            return {
              ...msg,
              questionData: {
                ...msg.questionData,
                answered: true,
                answers,
              },
            };
          }
          return msg;
        }),
      );
    },
    [],
  );

  const simulateOpenCodeFlow = useCallback(
    async (scenario: TestScenario) => {
      setCurrentScenario(scenario);
      setMessages([]);
      setStatus("connecting");
      setStatusMessage("Connecting to OpenCode...");

      await sleep(800);

      appendMessage(
        createMessage("user", `Testing scenario: ${scenario.name}`),
      );

      setStatus("processing");
      setStatusMessage("AI is thinking...");

      await sleep(1200);

      appendMessage(
        createMessage(
          "assistant",
          "I need some information before I can proceed. Please answer the following:",
        ),
      );

      await sleep(500);

      const questionData: QuestionData = {
        requestId: `req_${Date.now()}`,
        sessionId: "ses_test_123",
        questions: scenario.questions,
        answered: false,
      };
      appendMessage(createMessage("question", "", questionData));

      setStatus("waiting");
      setStatusMessage("Waiting for your response...");
    },
    [appendMessage],
  );

  const handleAnswerQuestion = useCallback(
    async (questionId: string, answers: string[][]) => {
      setAnswerLog((prev) => [
        ...prev,
        { questionId, answers, timestamp: new Date() },
      ]);

      markQuestionAsAnswered(questionId, answers);

      setStatus("processing");
      setStatusMessage("Processing your answer...");

      await sleep(1000);

      const responseContent = `Thank you! I received your answers:\n\n${answers
        .map((a, i) => `Question ${i + 1}: ${a.join(", ")}`)
        .join("\n")}\n\nI'll proceed with these preferences.`;

      appendMessage(createMessage("assistant", responseContent));

      setStatus("complete");
      setStatusMessage("Flow complete");
    },
    [appendMessage, markQuestionAsAnswered],
  );

  const handleReset = useCallback(() => {
    setMessages([]);
    setStatus("idle");
    setStatusMessage("");
    setCurrentScenario(null);
  }, []);

  const isFlowInProgress =
    status !== "idle" && status !== "complete" && status !== "error";

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Question Tool Test Page
          </h1>
          <p className="text-gray-500 mt-2">
            Test the OpenCode question tool flow with mock data
          </p>
        </header>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Test Scenarios</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TEST_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => simulateOpenCodeFlow(scenario)}
                  disabled={isFlowInProgress}
                  className={clsx(
                    "p-4 rounded-lg border text-left transition-all",
                    currentScenario?.id === scenario.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-blue-300 hover:bg-gray-50",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                >
                  <h3 className="font-medium text-gray-900">{scenario.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {scenario.description}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between items-center">
            <StatusLine status={status} message={statusMessage} />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={status === "idle"}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Conversation</h2>
          </CardHeader>
          <CardContent className="min-h-[300px]">
            <MessageDisplay
              messages={messages}
              onAnswerQuestion={handleAnswerQuestion}
            />
          </CardContent>
        </Card>

        <AnswerLog entries={answerLog} />

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Debug Information</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Status:</span>
                <span className="ml-2 font-mono">{status}</span>
              </div>
              <div>
                <span className="text-gray-500">Messages:</span>
                <span className="ml-2 font-mono">{messages.length}</span>
              </div>
              <div>
                <span className="text-gray-500">Current Scenario:</span>
                <span className="ml-2 font-mono">
                  {currentScenario?.id || "none"}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Answers Logged:</span>
                <span className="ml-2 font-mono">{answerLog.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">How to Use This Test Page</h2>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <ol className="list-decimal list-inside space-y-2 text-gray-600">
              <li>
                <strong>Select a scenario</strong> - Click one of the test
                scenarios above to start a simulated OpenCode flow.
              </li>
              <li>
                <strong>Observe the status</strong> - Watch the status line
                update as the flow progresses through different states.
              </li>
              <li>
                <strong>Answer the question</strong> - When the question card
                appears, select your options and click Submit.
              </li>
              <li>
                <strong>Check the logs</strong> - The Answer Log shows the raw
                data that would be sent to OpenCode.
              </li>
              <li>
                <strong>Reset and try again</strong> - Use the Reset button to
                clear everything and try another scenario.
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
