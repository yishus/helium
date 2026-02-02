import { useState, useRef, useEffect } from "react";
import {
  type KeyBinding,
  type SelectRenderable,
  type TextareaRenderable,
} from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { exec } from "child_process";
import { promisify } from "util";

import { isPrintableASCII } from "../helper";
import { THEME } from "../theme";

const execAsync = promisify(exec);

const slashCommands = [
  { name: "/model", description: "Select AI model", value: "model" },
  { name: "/exit", description: "Exit the application", value: "exit" },
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
    placeholder = "Ask Anything...",
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
  const [fileSearchVisible, setFileSearchVisible] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<
    Array<{ name: string; value: string; description: string }>
  >([]);
  const [currentAtQuery, setCurrentAtQuery] = useState("");
  const fileSelectRef = useRef<SelectRenderable>(null);

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
      if (key.name === "escape") {
        setPopOverVisible(false);
        return;
      }
    }

    if (fileSearchVisible) {
      if (key.name === "down") {
        fileSelectRef.current?.moveDown();
        return;
      }
      if (key.name === "up") {
        fileSelectRef.current?.moveUp();
        return;
      }
      if (key.name === "escape") {
        setFileSearchVisible(false);
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

    const words = currentInput.split(/\s+/);
    const lastWord = words[words.length - 1] || "";

    if (lastWord.startsWith("@")) {
      const query = lastWord.slice(1);
      setCurrentAtQuery(query);
      setFileSearchVisible(true);
      setPopOverVisible(false);
      return;
    } else if (fileSearchVisible) {
      setFileSearchVisible(false);
    }

    const queryInput = currentInput.slice(1);
    let filteredCommands = slashCommands;
    if (queryInput.length > 0) {
      filteredCommands = slashCommands.filter(({ name }) =>
        name.includes(queryInput),
      );
    }
    setAvailableCommands(filteredCommands);

    setPopOverVisible(currentInput[0] === "/" && filteredCommands.length > 0);
  });

  useEffect(() => {
    if (!fileSearchVisible) return;

    const searchFiles = async () => {
      try {
        const { stdout } = await execAsync(
          `git ls-files | fzf -f "${currentAtQuery}" | head -6`,
          { cwd: process.cwd() },
        );
        const files = stdout
          .trim()
          .split("\n")
          .filter((f) => f.length > 0)
          .map((file) => ({
            name: file,
            value: file,
            description: "",
          }));
        setAvailableFiles(files);
      } catch (error) {
        setAvailableFiles([]);
      }
    };

    searchFiles();
  }, [fileSearchVisible, currentAtQuery]);

  const handleSubmit = () => {
    const selectedFile = fileSelectRef.current?.getSelectedOption();
    if (selectedFile) {
      textareaRef.current?.deleteWordBackward();
      textareaRef.current?.insertText(`@${selectedFile.value}`);
      setFileSearchVisible(false);
      return;
    }

    const selectedOption = selectRef.current?.getSelectedOption();
    const submittedText = selectedOption?.value
      ? `/${selectedOption.value}`
      : textareaRef.current?.plainText || "";

    if (submittedText.length > 0) {
      onSubmit(submittedText);
      textareaRef.current?.clear();
      setPopOverVisible(false);
      setFileSearchVisible(false);
    }
  };

  return (
    <>
      {popOverVisible && (
        <box
          border={true}
          borderColor={THEME.colors.border.default}
          backgroundColor={THEME.colors.bg.secondary}
          style={{
            width: "100%",
            height: Math.min(2 * availableCommands.length, 4) + 2,
          }}
        >
          <select
            style={{ height: Math.min(2 * availableCommands.length, 4) }}
            options={availableCommands}
            focused={false}
            ref={selectRef}
          />
        </box>
      )}
      {fileSearchVisible && availableFiles.length > 0 && (
        <box
          border={true}
          borderColor={THEME.colors.border.default}
          backgroundColor={THEME.colors.bg.secondary}
          style={{
            height: 8,
            width: "100%",
          }}
        >
          <select
            style={{ height: 6 }}
            options={availableFiles}
            focused={false}
            ref={fileSelectRef}
          />
        </box>
      )}
      <box
        border={true}
        borderStyle="heavy"
        borderColor={THEME.colors.border.default}
        style={{
          width: "100%",
          flexDirection: "row",
        }}
      >
        <text fg={THEME.colors.text.muted}>&gt; </text>
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
