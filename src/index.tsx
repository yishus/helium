import { useState } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import { createEventBus } from "./event-bus";
import { Session } from "./session";
import HomeScreen from "./components/HomeScreen";
import CodingAgent from "./components/CodingAgent";

const eventBus = createEventBus();
const session = new Session({ eventBus });

const App = () => {
  const [sessionState, setSessionState] = useState<"startup" | "started">(
    "startup",
  );
  const handleInitialPromptSubmitted = () => {
    setSessionState("started");
  };

  return (
    <>
      {sessionState == "startup" && (
        <HomeScreen
          initialPromptSubmitted={handleInitialPromptSubmitted}
          session={session}
        />
      )}
      {sessionState == "started" && <CodingAgent eventBus={eventBus} />}
    </>
  );
};

const renderer = await createCliRenderer();
renderer.console.show();
createRoot(renderer).render(<App />);
