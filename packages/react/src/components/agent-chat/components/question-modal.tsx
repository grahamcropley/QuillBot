"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "../../../lib/cn";
import type { QuestionRequest } from "../agent-chat.types";

interface QuestionModalProps {
  request: QuestionRequest;
  onSubmit: (answers: string[][]) => void;
  onCancel: () => void;
}

export function QuestionModal({
  request,
  onSubmit,
  onCancel,
}: QuestionModalProps) {
  const { questions } = request;
  const isMultiStep = questions.length > 1;
  const totalSteps = isMultiStep ? questions.length + 1 : 1; // +1 for confirm step if multi

  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const [answers, setAnswers] = useState<string[][]>(
    Array(questions.length).fill([]),
  );
  const [customInputs, setCustomInputs] = useState<string[]>(
    Array(questions.length).fill(""),
  );

  const stepsRef = useRef<HTMLDivElement>(null);

  // Scroll active step into view
  useEffect(() => {
    if (stepsRef.current) {
      const activeStep = stepsRef.current.children[currentStep] as HTMLElement;
      if (activeStep && typeof activeStep.scrollIntoView === "function") {
        activeStep.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [currentStep]);

  const handleOptionToggle = (questionIndex: number, label: string) => {
    const question = questions[questionIndex];
    const isMultiple = question.multiple;
    const currentAnswers = answers[questionIndex];

    let newAnswers: string[];

    if (isMultiple) {
      if (currentAnswers.includes(label)) {
        newAnswers = currentAnswers.filter((a) => a !== label);
      } else {
        newAnswers = [...currentAnswers, label];
      }
    } else {
      // Single select: toggle off if clicked again, or switch to new one
      // Usually radio behavior implies switching, but let's allow deselect if clicked again?
      // Actually standard radio doesn't deselect. Let's stick to switch.
      // But if we want to allow deselecting the single option, we can.
      // For now, let's just set it.
      if (currentAnswers.includes(label)) {
        // Optionally allow deselect? Let's say yes for flexibility.
        newAnswers = [];
      } else {
        newAnswers = [label];
      }
    }

    setAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = newAnswers;
      return next;
    });
  };

  const handleCustomInputChange = (questionIndex: number, value: string) => {
    setCustomInputs((prev) => {
      const next = [...prev];
      next[questionIndex] = value;
      return next;
    });
  };

  const isCurrentStepValid = () => {
    if (currentStep >= questions.length) return true; // Confirm step is always valid
    const qIndex = currentStep;
    const hasAnswer = answers[qIndex].length > 0;
    const hasCustom = customInputs[qIndex].trim().length > 0;
    return hasAnswer || hasCustom;
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      setMaxVisited((prev) => Math.max(prev, nextStep));
    } else {
      // Final submit
      // Combine custom inputs into answers
      const finalAnswers = answers.map((ans, idx) => {
        const custom = customInputs[idx].trim();
        return custom ? [...ans, custom] : ans;
      });
      onSubmit(finalAnswers);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Render Logic
  const isConfirmStep = isMultiStep && currentStep === questions.length;
  const currentQuestion = !isConfirmStep ? questions[currentStep] : null;

  return (
    <div className="mx-4 flex max-h-[90%] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10">
      {/* Header / Progress */}
      {isMultiStep && (
        <div className="flex w-full items-center border-b border-zinc-100 bg-zinc-50/50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div
            ref={stepsRef}
            className="flex w-full overflow-x-auto whitespace-nowrap scrollbar-hide"
          >
            {questions.map((q, idx) => (
              <div key={idx} className="flex items-center">
                <button
                  onClick={() => idx <= maxVisited && setCurrentStep(idx)}
                  className={cn(
                    "text-xs font-medium transition-colors",
                    currentStep === idx
                      ? "text-blue-600 underline decoration-2 underline-offset-4 dark:text-blue-400"
                      : idx <= maxVisited
                        ? "text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
                        : "text-zinc-300 dark:text-zinc-600",
                  )}
                  disabled={idx > maxVisited}
                >
                  <span className="mr-1 opacity-50">{idx + 1}.</span>
                  {q.header.length > 15
                    ? q.header.slice(0, 15) + "…"
                    : q.header}
                </button>
                <span className="mx-2 text-zinc-200 dark:text-zinc-700">/</span>
              </div>
            ))}
            <button
              onClick={() =>
                maxVisited >= questions.length &&
                setCurrentStep(questions.length)
              }
              className={cn(
                "text-xs font-medium transition-colors",
                currentStep === questions.length
                  ? "text-blue-600 underline decoration-2 underline-offset-4 dark:text-blue-400"
                  : maxVisited >= questions.length
                    ? "text-zinc-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
                    : "text-zinc-300 dark:text-zinc-600",
              )}
              disabled={maxVisited < questions.length}
            >
              Confirm
            </button>
          </div>
          <button
            onClick={onCancel}
            className="ml-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        </div>
      )}

      {!isMultiStep && (
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 z-10 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          ✕
        </button>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isConfirmStep ? (
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Summary
            </h3>
            <div className="space-y-2.5">
              {questions.map((q, idx) => {
                const ans = answers[idx];
                const custom = customInputs[idx].trim();
                const all = custom ? [...ans, custom] : ans;
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/50"
                  >
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      {q.header}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {all.length > 0 ? (
                        all.map((a, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-md bg-white px-2 py-0.5 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:ring-zinc-600"
                          >
                            {a}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm italic text-zinc-400">
                          No answer
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          currentQuestion && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-lg font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
                  {currentQuestion.question}
                </h3>
                {currentQuestion.multiple && (
                  <p className="mt-1.5 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    Select all that apply
                  </p>
                )}
              </div>

              <div className="space-y-2">
                {currentQuestion.options.map((opt) => {
                  const isSelected = answers[currentStep].includes(opt.label);
                  return (
                    <button
                      key={opt.label}
                      onClick={() => handleOptionToggle(currentStep, opt.label)}
                      className={cn(
                        "group flex w-full flex-col items-start rounded-lg border px-3 py-2.5 text-left transition-all",
                        isSelected
                          ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500 dark:border-blue-500 dark:bg-blue-500/10"
                          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-700/50",
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span
                          className={cn(
                            "text-sm font-medium",
                            isSelected
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-zinc-900 dark:text-zinc-100",
                          )}
                        >
                          {opt.label}
                        </span>
                        {isSelected && (
                          <span className="ml-2 text-sm text-blue-600 dark:text-blue-400">
                            ✓
                          </span>
                        )}
                      </div>
                      {opt.description && (
                        <span
                          className={cn(
                            "mt-0.5 text-xs",
                            isSelected
                              ? "text-blue-600/80 dark:text-blue-300/70"
                              : "text-zinc-500 dark:text-zinc-400",
                          )}
                        >
                          {opt.description}
                        </span>
                      )}
                    </button>
                  );
                })}

                {currentQuestion.custom !== false && (
                  <div className="pt-1">
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Type your own answer
                    </label>
                    <input
                      type="text"
                      value={customInputs[currentStep]}
                      onChange={(e) =>
                        handleCustomInputChange(currentStep, e.target.value)
                      }
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
                      placeholder="Other..."
                    />
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
        <button
          onClick={handleBack}
          disabled={currentStep === 0}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            currentStep === 0
              ? "invisible"
              : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
          )}
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!isCurrentStepValid()}
          className={cn(
            "rounded-xl px-6 py-2 text-sm font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20",
            !isCurrentStepValid()
              ? "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
              : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md dark:bg-blue-600 dark:hover:bg-blue-500",
          )}
        >
          {currentStep === totalSteps - 1 ? "Submit" : "Next"}
        </button>
      </div>
    </div>
  );
}
