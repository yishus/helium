import { useRef, useState } from "react";
import {
  type SelectRenderable,
  type SelectOption,
  type TextareaRenderable,
  type KeyBinding,
} from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import type { AskUserQuestionInput } from "../tools/ask-user-question";
import type { QuestionAnswer } from "../session";
import { THEME } from "../theme";

interface Props {
  input: AskUserQuestionInput;
  onSubmit: (answers: QuestionAnswer[]) => void;
  onCancel: () => void;
}

interface QuestionState {
  selectedIndices: Set<number>;
  showOtherInput: boolean;
  otherText: string;
}

const AskUserQuestionDialog = ({ input, onSubmit, onCancel }: Props) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionStates, setQuestionStates] = useState<QuestionState[]>(
    input.questions.map(() => ({
      selectedIndices: new Set<number>(),
      showOtherInput: false,
      otherText: "",
    })),
  );
  const [isEditingOther, setIsEditingOther] = useState(false);
  const selectRef = useRef<SelectRenderable>(null);
  const textareaRef = useRef<TextareaRenderable>(null);

  const currentQuestion = input.questions[currentQuestionIndex]!;
  const currentState = questionStates[currentQuestionIndex]!;

  const options: SelectOption[] = [
    ...currentQuestion.options.map((opt, idx) => ({
      name: currentQuestion.multiSelect
        ? `[${currentState.selectedIndices.has(idx) ? "x" : " "}] ${opt.label}`
        : opt.label,
      description: opt.description,
      value: String(idx),
    })),
    {
      name: currentQuestion.multiSelect
        ? `[${currentState.showOtherInput ? "x" : " "}] Other...`
        : "Other...",
      description: "Provide custom text input",
      value: "other",
    },
  ];

  const handleSelect = (value: string) => {
    if (value === "other") {
      if (currentQuestion.multiSelect) {
        setQuestionStates((prev) => {
          const newStates = [...prev];
          newStates[currentQuestionIndex] = {
            ...currentState,
            showOtherInput: !currentState.showOtherInput,
          };
          return newStates;
        });
        if (!currentState.showOtherInput) {
          setIsEditingOther(true);
        }
      } else {
        setQuestionStates((prev) => {
          const newStates = [...prev];
          newStates[currentQuestionIndex] = {
            ...currentState,
            selectedIndices: new Set(),
            showOtherInput: true,
          };
          return newStates;
        });
        setIsEditingOther(true);
      }
    } else {
      const idx = parseInt(value, 10);
      if (currentQuestion.multiSelect) {
        setQuestionStates((prev) => {
          const newStates = [...prev];
          const newSelected = new Set(currentState.selectedIndices);
          if (newSelected.has(idx)) {
            newSelected.delete(idx);
          } else {
            newSelected.add(idx);
          }
          newStates[currentQuestionIndex] = {
            ...currentState,
            selectedIndices: newSelected,
          };
          return newStates;
        });
      } else {
        setQuestionStates((prev) => {
          const newStates = [...prev];
          newStates[currentQuestionIndex] = {
            ...currentState,
            selectedIndices: new Set([idx]),
            showOtherInput: false,
          };
          return newStates;
        });
      }
    }
  };

  const submitCurrentQuestion = () => {
    if (currentQuestionIndex < input.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setIsEditingOther(false);
    } else {
      // All questions answered, compile results
      const answers: QuestionAnswer[] = input.questions.map((q, qIdx) => {
        const state = questionStates[qIdx]!;
        const selectedLabels = Array.from(state.selectedIndices).map(
          (idx) => q.options[idx]!.label,
        );
        return {
          question: q.question,
          selectedLabels,
          customText: state.showOtherInput ? state.otherText : undefined,
        };
      });
      onSubmit(answers);
    }
  };

  const textareaKeyBindings: KeyBinding[] = [
    { name: "return", action: "submit" },
  ];

  const handleTextareaSubmit = () => {
    const text = textareaRef.current?.plainText || "";
    const updatedState = {
      ...currentState,
      otherText: text,
    };

    setQuestionStates((prev) => {
      const newStates = [...prev];
      newStates[currentQuestionIndex] = updatedState;
      return newStates;
    });
    setIsEditingOther(false);

    // For single-select, auto-submit after entering custom text
    if (!currentQuestion.multiSelect) {
      // Need to compute answers with the updated state directly
      if (currentQuestionIndex < input.questions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1);
      } else {
        // All questions answered, compile results with the updated state
        const answers: QuestionAnswer[] = input.questions.map((q, qIdx) => {
          const state =
            qIdx === currentQuestionIndex
              ? updatedState
              : questionStates[qIdx]!;
          const selectedLabels = Array.from(state.selectedIndices).map(
            (idx) => q.options[idx]!.label,
          );
          return {
            question: q.question,
            selectedLabels,
            customText: state.showOtherInput ? state.otherText : undefined,
          };
        });
        onSubmit(answers);
      }
    }
  };

  useKeyboard((key) => {
    if (isEditingOther) {
      if (key.name === "escape") {
        setIsEditingOther(false);
        return;
      }
      // Let textarea handle other keys
      return;
    }

    if (key.name === "escape") {
      onCancel();
      return;
    }

    if (key.name === "down") {
      selectRef.current?.moveDown();
      return;
    }
    if (key.name === "up") {
      selectRef.current?.moveUp();
      return;
    }
    if (key.name === "return") {
      const selectedValue = selectRef.current?.getSelectedOption()?.value;
      if (selectedValue !== undefined) {
        handleSelect(selectedValue);
        if (!currentQuestion.multiSelect && selectedValue !== "other") {
          submitCurrentQuestion();
        }
      }
      return;
    }
    if (key.name === "space" && currentQuestion.multiSelect) {
      const selectedValue = selectRef.current?.getSelectedOption()?.value;
      if (selectedValue !== undefined) {
        handleSelect(selectedValue);
      }
      return;
    }
    // Submit with 's' for multiSelect after making selections
    if (key.sequence === "s" && currentQuestion.multiSelect) {
      if (
        currentState.selectedIndices.size > 0 ||
        (currentState.showOtherInput && currentState.otherText)
      ) {
        submitCurrentQuestion();
      }
    }
  });

  const hasSelection =
    currentState.selectedIndices.size > 0 ||
    (currentState.showOtherInput && currentState.otherText);

  return (
    <box
      borderColor={THEME.colors.border.default}
      style={{ padding: 1 }}
      border={["left"]}
    >
      <box style={{ flexDirection: "row", marginBottom: 1 }}>
        <text fg={THEME.colors.text.muted}>
          [{currentQuestion.header}] Question {currentQuestionIndex + 1}/
          {input.questions.length}
        </text>
      </box>
      <text fg={THEME.colors.text.primary} style={{ marginBottom: 1 }}>
        {currentQuestion.question}
      </text>
      {currentQuestion.multiSelect && (
        <text fg={THEME.colors.text.muted} style={{ marginBottom: 1 }}>
          (Space to toggle, 's' to submit)
        </text>
      )}
      <select
        style={{ height: Math.min(options.length * 2 + 2, 12) }}
        options={options}
        focused={false}
        ref={selectRef}
      />
      {currentState.showOtherInput && (
        <box style={{ marginTop: 1 }}>
          <text fg={THEME.colors.text.muted}>
            Custom response (Enter to confirm, Escape to cancel):
          </text>
          <box
            border={true}
            borderColor={
              isEditingOther
                ? THEME.colors.border.focus
                : THEME.colors.border.default
            }
            style={{ marginTop: 1 }}
          >
            <textarea
              minHeight={2}
              maxHeight={4}
              focused={isEditingOther}
              ref={textareaRef}
              keyBindings={textareaKeyBindings}
              onSubmit={handleTextareaSubmit}
            />
          </box>
          {currentState.otherText && (
            <text fg={THEME.colors.text.secondary}>
              Saved: {currentState.otherText}
            </text>
          )}
        </box>
      )}
      {currentQuestion.multiSelect && hasSelection && (
        <text fg={THEME.colors.text.secondary} style={{ marginTop: 1 }}>
          Press 's' to submit and continue
        </text>
      )}
    </box>
  );
};

export default AskUserQuestionDialog;
