import { useEffect, useRef, useState } from "react";
import { type SelectRenderable } from "@opentui/core";
import type { SelectOption } from "@opentui/core";

import {
  Session,
  type ToolUseRequest,
  type UIMessage,
  type ModelId,
  AVAILABLE_MODELS,
} from "../session";
import ChatTextbox from "./ChatTextbox";
import { useKeyboard } from "@opentui/react";
import type { ToolInputMap } from "../tools";

interface Props {
  session: Session;
  userPrompt: string;
}

const toolUseRequestoptions: SelectOption[] = [
  { name: "Yes", description: "Allow agent to use tool", value: "yes" },
  {
    name: "No",
    description: "Disallow agent's request to use tool",
    value: "no",
  },
];

const modelOptions: SelectOption[] = AVAILABLE_MODELS.map((m) => ({
  name: m.name,
  description: m.id,
  value: m.id,
}));

const CodingAgent = (props: Props) => {
  const { session, userPrompt } = props;
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [tokenCost, setTokenCost] = useState(0);
  const [tokenUsage, setTokenUsage] = useState(0);
  const [showToolUseRequest, setShowToolUseRequest] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [currentModel, setCurrentModel] = useState<ModelId>(session.getModel());
  const toolUseRequestRef = useRef<ToolUseRequest | null>(null);
  const selectRef = useRef<SelectRenderable>(null);
  const modelSelectRef = useRef<SelectRenderable>(null);
  const pendingApprovalRef = useRef<{
    resolve: (approved: boolean) => void;
  } | null>(null);

  useEffect(() => {
    session.canUseToolHandler = async (request: ToolUseRequest) => {
      toolUseRequestRef.current = request;
      setShowToolUseRequest(true);

      return new Promise<boolean>((resolve) => {
        pendingApprovalRef.current = { resolve };
      });
    };
  }, []);

  useEffect(() => {
    session.eventEmitter.on("message_start", (event) => {
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: event.role, text: "" },
      ]);
    });

    session.eventEmitter.on("message_update", (event) => {
      setMessages((prevMessages) => {
        const messages = [...prevMessages];
        const lastMessage = messages.pop();
        if (lastMessage) {
          lastMessage.text += event.text;
          return [...messages, lastMessage];
        }

        return prevMessages;
      });
    });

    session.eventEmitter.on("token_usage_update", (event) => {
      setTokenCost(event.cost);
      setTokenUsage(event.token_count);
    });

    // Handle the initial prompt
    handleSubmit(userPrompt);
  }, []);

  useKeyboard((key) => {
    if (showModelSelector) {
      if (key.name === "down") {
        modelSelectRef.current?.moveDown();
        return;
      }
      if (key.name === "up") {
        modelSelectRef.current?.moveUp();
        return;
      }
      if (key.name === "return") {
        const selected = modelSelectRef.current?.getSelectedOption();
        if (selected?.value) {
          const newModel = selected.value as ModelId;
          session.setModel(newModel);
          setCurrentModel(newModel);
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: `Model changed to ${selected.name}` },
          ]);
        }
        setShowModelSelector(false);
        return;
      }
      if (key.name === "escape") {
        setShowModelSelector(false);
        return;
      }
    }

    if (showToolUseRequest) {
      if (key.name === "down") {
        selectRef.current?.moveDown();
        return;
      }
      if (key.name === "up") {
        selectRef.current?.moveUp();
        return;
      }
      if (key.name === "return") {
        const selected = selectRef.current?.getSelectedOption();
        const approved = selected?.value === "yes";

        pendingApprovalRef.current?.resolve(approved);
        pendingApprovalRef.current = null;

        setShowToolUseRequest(false);
      }
    }
  });

  const renderMessage = (message: UIMessage, index: number) => {
    if (message.role === "user") {
      return (
        <box key={index} style={{ width: "100%", border: true }}>
          <text>{message.text}</text>
        </box>
      );
    }
    return <text key={index}>{message.text}</text>;
  };

  const renderToolUseRequest = () => {
    if (!showToolUseRequest || toolUseRequestRef.current === null) {
      return null;
    }
    const { toolName, description, input } = toolUseRequestRef.current;
    let diffContent;
    if (toolName === "edit") {
      diffContent = session.computeEditDiff(input as ToolInputMap["edit"]);
    } else if (toolName === "write") {
      diffContent = session.computeWriteDiff(input as ToolInputMap["write"]);
    }
    return (
      <>
        <text>{`${toolName} ${description}`}</text>
        {diffContent && <diff diff={diffContent} showLineNumbers={true} />}
        <select
          style={{ height: 6 }}
          options={toolUseRequestoptions}
          focused={false}
          ref={selectRef}
        />
      </>
    );
  };

  const renderModelSelector = () => {
    if (!showModelSelector) {
      return null;
    }
    const currentModelName =
      AVAILABLE_MODELS.find((m) => m.id === currentModel)?.name ?? "Unknown";
    return (
      <box style={{ border: true, padding: 1 }}>
        <text style={{ marginBottom: 1 }}>
          Select model (current: {currentModelName})
        </text>
        <select
          style={{ height: 4 }}
          options={modelOptions}
          focused={false}
          ref={modelSelectRef}
        />
        <text style={{ marginTop: 1 }}>
          Press Enter to select, Escape to cancel
        </text>
      </box>
    );
  };

  const handleSubmit = (submittedText: string) => {
    if (submittedText === "/model") {
      setShowModelSelector(true);
      return;
    }
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", text: submittedText },
    ]);
    session.prompt(submittedText);
  };

  return (
    <box style={{ flexDirection: "row", width: "100%", height: "100%" }}>
      <box style={{ width: "75%", border: true, flexDirection: "column" }}>
        <scrollbox
          style={{ flexGrow: 1 }}
          stickyScroll={true}
          stickyStart="bottom"
        >
          {messages.map(renderMessage)}
          {renderToolUseRequest()}
          {renderModelSelector()}
        </scrollbox>
        <ChatTextbox onSubmit={handleSubmit} minHeight={3} />
      </box>
      <box style={{ width: "25%", border: true, flexDirection: "column" }}>
        <text>
          Model:{" "}
          {AVAILABLE_MODELS.find((m) => m.id === currentModel)?.name ??
            "Unknown"}
        </text>
        <text>Tokens used: {tokenUsage}</text>
        <text>Cost: ${tokenCost.toFixed(6)}</text>
      </box>
    </box>
  );
};

export default CodingAgent;
