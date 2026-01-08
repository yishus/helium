import { useEffect, useState } from "react";

import { type EventBusController } from "../event-bus";

interface Props {
  eventBus: EventBusController;
}

const CodingAgent = (props: Props) => {
  const { eventBus } = props;
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const eventBusHandler = (event: unknown) => {
      console.log("Received session stream event:", event);
    };
    eventBus.on("sessionStream", eventBusHandler);
  }, []);

  return (
    <box style={{ flexDirection: "row", width: "100%", height: "100%" }}>
      <box style={{ width: "75%", border: true }}>{messages}</box>
      <box style={{ width: "25%", border: true }}></box>
    </box>
  );
};

export default CodingAgent;
