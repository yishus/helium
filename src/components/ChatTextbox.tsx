import { useState, useRef } from "react";
import {
  type KeyBinding,
  type SelectRenderable,
  type TextareaRenderable,
} from "@opentui/core";
import { useKeyboard } from "@opentui/react";

import { isPrintableASCII } from "../helper";

const slashCommands = [
  { name: "/model", description: "Select AI model", value: "model" },
];

interface Props {
  onSubmit: (text: string) => void;
  minHeight?: number;
  maxHeight?: number;
  placeholder?: string;
}

const ChatTextbox = (props: Props) => {
  const {
    onSubmit,
    minHeight = 1,
    maxHeight = 6,
    placeholder = "Type here...",
  } = props;

  const textareaRef = useRef<TextareaRenderable>(null);
  const selectRef = useRef<SelectRenderable>(null);

  const keyBindings: KeyBinding[] = [
    {
      name: "return",
      shift: true,
      action: "newline",
    },
    {
      name: "return",
      action: "submit",
    },
  ];

  const [popOverVisible, setPopOverVisible] = useState(false);
  const [availableCommands, setAvailableCommands] = useState(slashCommands);

  useKeyboard((key) => {
    if (popOverVisible) {
      if (key.name === "down") {
        selectRef.current?.moveDown();
        return;
      }
      if (key.name === "up") {
        selectRef.current?.moveUp();
        return;
      }
    }

    let currentInput = textareaRef.current?.plainText || "";
    if (key.name === "backspace") {
      currentInput = currentInput.slice(0, -1);
    }
    if (isPrintableASCII(key.sequence)) {
      currentInput += key.sequence;
    }

    if (
      popOverVisible &&
      (currentInput.length == 0 || currentInput[0] !== "/")
    ) {
      setPopOverVisible(false);
      return;
    }

    const queryInput = currentInput.slice(1); // Remove the leading "/"
    let filteredCommands = slashCommands;
    if (queryInput.length > 0) {
      filteredCommands = slashCommands.filter(({ name }) =>
        name.includes(queryInput),
      );
    }
    setAvailableCommands(filteredCommands);

    setPopOverVisible(currentInput[0] === "/" && filteredCommands.length > 0);
  });

  const handleSubmit = () => {
    const selectedOption = selectRef.current?.getSelectedOption();
    const submittedText = selectedOption?.value
      ? `/${selectedOption.value}`
      : textareaRef.current?.plainText || "";
    if (submittedText.length > 0) {
      onSubmit(submittedText);
      textareaRef.current?.clear();
      setPopOverVisible(false);
    }
  };

  return (
    <>
      {popOverVisible && (
        <box
          style={{
            border: true,
            height: 6,
            width: "100%",
          }}
        >
          <select
            style={{ height: 4 }}
            options={availableCommands}
            focused={false}
            ref={selectRef}
          />
        </box>
      )}
      <box
        style={{
          border: true,
          width: "100%",
          flexDirection: "row",
        }}
      >
        <text>&gt; </text>
        <textarea
          ref={textareaRef}
          placeholder={placeholder}
          minHeight={minHeight}
          maxHeight={maxHeight}
          focused={true}
          flexGrow={1}
          keyBindings={keyBindings}
          onSubmit={handleSubmit}
        />
      </box>
    </>
  );
};

export default ChatTextbox;
