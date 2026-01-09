import { useEffect, useState } from "react";

import { EventBus } from "../event-bus";
import type { UIMessage } from "../session";

interface Props {
  eventBus: EventBus;
  userPrompt: string;
}

const CodingAgent = (props: Props) => {
  const { eventBus, userPrompt } = props;
  const [messages, setMessages] = useState<UIMessage[]>([
    { role: "user", text: userPrompt },
  ]);

  useEffect(() => {
    eventBus.on("message_start", (event) => {
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: event.role, text: "" },
      ]);
    });

    eventBus.on("message_update", (event) => {
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

  const renderMessage = (message: UIMessage, index: number) => {
    return <text key={index}>{message.text}</text>;
  };

  return (
    <box style={{ flexDirection: "row", width: "100%", height: "100%" }}>
      <box style={{ width: "75%", border: true }}>
        {messages.map(renderMessage)}
      </box>
      <box style={{ width: "25%", border: true }}></box>
    </box>
  );
};

export default CodingAgent;
