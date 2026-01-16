import { useEffect, useRef, useState } from "react";
import {
  type KeyBinding,
  type SelectRenderable,
  type TextareaRenderable,
} from "@opentui/core";
import type { SelectOption } from "@opentui/core";

import { Session, type UIMessage } from "../session";
import ChatTextbox from "./ChatTextbox";
import { useKeyboard } from "@opentui/react";

interface Props {
  session: Session;
  userPrompt: string;
}

const toolUseRequestoptions: SelectOption[] = [
  { name: "Yes", description: "Option 1 description", value: "yes" },
  { name: "No", description: "Option 2 description", value: "no" },
];

const CodingAgent = (props: Props) => {
  const { session, userPrompt } = props;
  const [messages, setMessages] = useState<UIMessage[]>([
    { role: "user", text: userPrompt },
  ]);
  const [showToolUseRequest, setShowToolUseRequest] = useState(false);
  const toolUseRequestRef = useRef<{ toolName: string } | null>(null);
  const selectRef = useRef<SelectRenderable>(null);
  const pendingApprovalRef = useRef<{
    resolve: (approved: boolean) => void;
  } | null>(null);

  useEffect(() => {
    session.canUseToolHandler = async (toolName: string) => {
      toolUseRequestRef.current = { toolName };
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
  }, []);

  useKeyboard((key) => {
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

  const handleSubmit = (submittedText: string) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", text: submittedText },
    ]);
    session.prompt(submittedText);
  };

  return (
    <box style={{ flexDirection: "row", width: "100%", height: "100%" }}>
      <box style={{ width: "75%", border: true, flexDirection: "column" }}>
        <scrollbox style={{ flexGrow: 1 }}>
          {messages.map(renderMessage)}
          {showToolUseRequest && (
            <>
              <text>{toolUseRequestRef.current?.toolName}</text>
              <select
                style={{ height: 6 }}
                options={toolUseRequestoptions}
                focused={false}
                ref={selectRef}
              />
            </>
          )}
        </scrollbox>
        <ChatTextbox onSubmit={handleSubmit} minHeight={3} />
      </box>
      <box style={{ width: "25%", border: true }}></box>
    </box>
  );
};

export default CodingAgent;
