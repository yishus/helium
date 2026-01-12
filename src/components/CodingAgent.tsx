import { useEffect, useState } from "react";

import { EventBus } from "../event-bus";
import { Session, type UIMessage } from "../session";
import ChatTextbox from "./ChatTextbox";

interface Props {
  eventBus: EventBus;
  session: Session;
  userPrompt: string;
}

const CodingAgent = (props: Props) => {
  const { eventBus, session, userPrompt } = props;
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
        </scrollbox>
        <ChatTextbox onSubmit={handleSubmit} minHeight={3} />
      </box>
      <box style={{ width: "25%", border: true }}></box>
    </box>
  );
};

export default CodingAgent;
