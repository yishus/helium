import { useEffect, useState, useRef } from "react";
import {
  createCliRenderer,
  type KeyBinding,
  type SelectRenderable,
  type TextareaRenderable,
} from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";

import { isPrintableASCII } from "./helper";

function App() {
  const textareaRef = useRef<TextareaRenderable>(null);
  const selectRef = useRef<SelectRenderable>(null);

  const slashCommands = [
    { name: "/help", description: "Show available commands", value: "help" },
    { name: "/clear", description: "Clear the conversation", value: "clear" },
    { name: "/commit", description: "Create a git commit", value: "commit" },
    { name: "/review", description: "Review recent changes", value: "review" },
    {
      name: "/plan",
      description: "Create an implementation plan",
      value: "/plan",
    },
  ];

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

  useEffect(() => {
    renderer.console.show();
  }, [renderer]);

  useKeyboard((key) => {
    if (popOverVisible) {
      if (key.name === "down") {
        selectRef.current?.moveDown();
      }
      if (key.name === "up") {
        selectRef.current?.moveUp();
      }
      if (
        key.name === "backspace" &&
        textareaRef.current?.plainText === "/" &&
        popOverVisible
      ) {
        setPopOverVisible(false);
      }

      let currentInput = textareaRef.current?.plainText || "";
      if (key.name === "backspace") {
        currentInput = currentInput.slice(0, -1);
      }
      if (isPrintableASCII(key.sequence)) {
        currentInput += key.sequence;
      }
      currentInput = currentInput.slice(1); // Remove the leading "/"
      let filteredCommands = slashCommands;
      if (currentInput.length > 0) {
        filteredCommands = slashCommands.filter(({ name }) =>
          name.includes(currentInput),
        );
      }
      setAvailableCommands(filteredCommands);
    } else {
      if (key.name === "/" && textareaRef.current?.plainText.length === 0) {
        setPopOverVisible(true);
      }
    }
  });

  const handleSubmit = () => {
    const selectedOption = selectRef.current?.getSelectedOption();
    const submittedText =
      selectedOption?.value || textareaRef.current?.plainText || "";
    console.log("Submitted:", submittedText);
  };

  return (
    <box
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
      }}
    >
      <box
        style={{
          justifyContent: "center",
          alignItems: "center",
          minWidth: 50,
          width: "50%",
        }}
      >
        <ascii-font font="tiny" text="helium" />
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
            placeholder="Type here..."
            minHeight={1}
            maxHeight={6}
            focused={true}
            flexGrow={1}
            keyBindings={keyBindings}
            onSubmit={handleSubmit}
          />
        </box>
      </box>
    </box>
  );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
