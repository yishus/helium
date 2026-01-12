import { useState } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import { EventBus } from "./event-bus";
import { Session } from "./session";
import HomeScreen from "./components/HomeScreen";
import CodingAgent from "./components/CodingAgent";

const eventBus = new EventBus();
const session = new Session({ eventBus });

const App = () => {
  const [sessionState, setSessionState] = useState<"startup" | "started">(
    "startup",
  );
  const [initialPrompt, setInitialPrompt] = useState<string>("");
  const handleInitialPromptSubmitted = (prompt: string) => {
    setSessionState("started");
    setInitialPrompt(prompt);
  };

  return (
    <>
      {sessionState == "startup" && (
        <HomeScreen
          initialPromptSubmitted={handleInitialPromptSubmitted}
          session={session}
        />
      )}
      {sessionState == "started" && (
        <CodingAgent
          eventBus={eventBus}
          session={session}
          userPrompt={initialPrompt}
        />
      )}
    </>
  );
};

const renderer = await createCliRenderer();
renderer.console.show();
createRoot(renderer).render(<App />);
