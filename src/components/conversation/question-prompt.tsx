"use client";

import { useState, useCallback } from "react";
import { clsx } from "clsx";
import { Check, Square, CheckSquare, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { QuestionData, QuestionInfo } from "@/types";

interface QuestionPromptProps {
  questionData: QuestionData;
  onSubmit: (answers: string[][]) => void;
}

interface QuestionBlockProps {
  info: QuestionInfo;
  selectedAnswers: string[];
  onAnswerChange: (answers: string[]) => void;
  disabled?: boolean;
}

function QuestionBlock({
  info,
  selectedAnswers,
  onAnswerChange,
  disabled,
}: QuestionBlockProps) {
  const [customInput, setCustomInput] = useState("");
  const [isOtherSelected, setIsOtherSelected] = useState(false);

  const handleOptionToggle = (optionLabel: string) => {
    if (disabled) return;

    if (info.multiple) {
      if (selectedAnswers.includes(optionLabel)) {
        onAnswerChange(selectedAnswers.filter((a) => a !== optionLabel));
      } else {
        onAnswerChange([...selectedAnswers, optionLabel]);
      }
    } else {
      onAnswerChange([optionLabel]);
      setIsOtherSelected(false);
    }
  };

  const handleOtherToggle = () => {
    if (disabled) return;

    if (info.multiple) {
      const newIsOther = !isOtherSelected;
      setIsOtherSelected(newIsOther);

      if (!newIsOther) {
        const predefinedLabels = new Set(info.options.map((o) => o.label));
        onAnswerChange(selectedAnswers.filter((a) => predefinedLabels.has(a)));
      } else {
        if (customInput.trim()) {
          onAnswerChange([...selectedAnswers, customInput.trim()]);
        }
      }
    } else {
      setIsOtherSelected(true);
      if (customInput.trim()) {
        onAnswerChange([customInput.trim()]);
      } else {
        onAnswerChange([]);
      }
    }
  };

  const handleCustomInputChange = (value: string) => {
    setCustomInput(value);

    if (info.multiple) {
      const predefinedLabels = new Set(info.options.map((o) => o.label));
      const cleanAnswers = selectedAnswers.filter((a) =>
        predefinedLabels.has(a),
      );

      if (value.trim()) {
        onAnswerChange([...cleanAnswers, value.trim()]);
      } else {
        onAnswerChange(cleanAnswers);
      }
    } else {
      if (value.trim()) {
        onAnswerChange([value.trim()]);
      } else {
        onAnswerChange([]);
      }
    }
  };

  const predefinedLabels = new Set(info.options.map((o) => o.label));

  const effectiveIsOtherSelected = disabled
    ? selectedAnswers.some((a) => !predefinedLabels.has(a))
    : isOtherSelected;

  const effectiveCustomInputValue = disabled
    ? selectedAnswers.find((a) => !predefinedLabels.has(a)) || ""
    : customInput;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {info.header}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {info.question}
        </p>
      </div>

      <div className="space-y-2" role={info.multiple ? "group" : "radiogroup"}>
        {info.options.map((option) => {
          const isSelected = selectedAnswers.includes(option.label);
          const CheckIcon = isSelected ? CheckSquare : Square;

          return (
            <div
              key={option.label}
              onClick={() => handleOptionToggle(option.label)}
              className={clsx(
                "relative flex items-start p-3 rounded-lg border cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700",
                isSelected
                  ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950"
                  : "border-gray-200 dark:border-gray-700",
                disabled &&
                  "opacity-60 cursor-not-allowed hover:bg-transparent dark:hover:bg-transparent",
              )}
              role={info.multiple ? "checkbox" : "radio"}
              aria-checked={isSelected}
            >
              <div className="flex items-center h-5">
                {info.multiple ? (
                  <CheckIcon
                    className={clsx(
                      "h-5 w-5",
                      isSelected
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-400 dark:text-gray-500",
                    )}
                  />
                ) : (
                  <div
                    className={clsx(
                      "h-5 w-5 rounded-full border flex items-center justify-center",
                      isSelected
                        ? "border-blue-600 dark:border-blue-400"
                        : "border-gray-400 dark:border-gray-500",
                    )}
                  >
                    {isSelected && (
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                    )}
                  </div>
                )}
              </div>
              <div className="ml-3 text-sm">
                <span
                  className={clsx(
                    "font-medium block",
                    isSelected
                      ? "text-blue-900 dark:text-blue-100"
                      : "text-gray-900 dark:text-gray-100",
                  )}
                >
                  {option.label}
                </span>
                {option.description && (
                  <span className="text-gray-500 dark:text-gray-400 block mt-0.5">
                    {option.description}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {info.custom !== false && (
          <div
            className={clsx(
              "relative rounded-lg border transition-all",
              effectiveIsOtherSelected
                ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950"
                : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700",
              disabled && "opacity-60",
            )}
          >
            <div
              className="flex items-start p-3 cursor-pointer"
              onClick={handleOtherToggle}
            >
              <div className="flex items-center h-5">
                {info.multiple ? (
                  <div
                    className={clsx(
                      "h-5 w-5 border rounded flex items-center justify-center",
                      effectiveIsOtherSelected
                        ? "border-blue-600 dark:border-blue-400 bg-transparent"
                        : "border-gray-400 dark:border-gray-500",
                    )}
                  >
                    {effectiveIsOtherSelected && (
                      <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                ) : (
                  <div
                    className={clsx(
                      "h-5 w-5 rounded-full border flex items-center justify-center",
                      effectiveIsOtherSelected
                        ? "border-blue-600 dark:border-blue-400"
                        : "border-gray-400 dark:border-gray-500",
                    )}
                  >
                    {effectiveIsOtherSelected && (
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                    )}
                  </div>
                )}
              </div>
              <div className="ml-3 text-sm flex-1">
                <span
                  className={clsx(
                    "font-medium block",
                    effectiveIsOtherSelected
                      ? "text-blue-900 dark:text-blue-100"
                      : "text-gray-900 dark:text-gray-100",
                  )}
                >
                  Other
                </span>
                <span className="text-gray-500 dark:text-gray-400 block mt-0.5">
                  Specify your own answer
                </span>
              </div>
            </div>

            {effectiveIsOtherSelected && (
              <div className="px-3 pb-3 ml-8">
                <Input
                  value={effectiveCustomInputValue}
                  onChange={(e) => handleCustomInputChange(e.target.value)}
                  placeholder="Type your answer here..."
                  disabled={disabled}
                  autoFocus={!disabled}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function QuestionPrompt({
  questionData,
  onSubmit,
}: QuestionPromptProps) {
  const [answers, setAnswers] = useState<string[][]>(
    questionData.questions.map(
      (_, index) => questionData.answers?.[index] || [],
    ),
  );

  const isAnswered = questionData.answered;

  const handleAnswerChange = useCallback(
    (questionIndex: number, newAnswers: string[]) => {
      setAnswers((prev) => {
        const next = [...prev];
        next[questionIndex] = newAnswers;
        return next;
      });
    },
    [],
  );

  const handleSubmit = () => {
    onSubmit(answers);
  };

  const isValid = answers.every((a) => a.length > 0);

  return (
    <Card
      className={clsx(
        "w-full my-4",
        isAnswered && "bg-gray-50 dark:bg-gray-900",
      )}
    >
      <CardHeader>
        <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 mb-1">
          <Info className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">
            {isAnswered ? "Answered Question" : "Action Required"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {questionData.questions.map((question, index) => (
          <div
            key={question.question}
            className={
              index > 0
                ? "pt-6 border-t border-gray-100 dark:border-gray-800"
                : ""
            }
          >
            <QuestionBlock
              info={question}
              selectedAnswers={answers[index]}
              onAnswerChange={(newAnswers) =>
                handleAnswerChange(index, newAnswers)
              }
              disabled={isAnswered}
            />
          </div>
        ))}
      </CardContent>

      {!isAnswered && (
        <CardFooter className="flex justify-end pt-4">
          <Button
            onClick={handleSubmit}
            disabled={!isValid}
            variant="primary"
            size="md"
          >
            Submit Answer
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
