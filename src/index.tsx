import { useState } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import { Session } from "./session";
import HomeScreen from "./components/HomeScreen";
import CodingAgent from "./components/CodingAgent";

const session = new Session();

const App = () => {
  const [sessionState, setSessionState] = useState<"startup" | "started">(
    "startup",
  );
  const [initialPrompt, setInitialPrompt] = useState<string>("");
  const handleInitialPromptSubmitted = (prompt: string) => {
    session.prompt(prompt);
    setSessionState("started");
    setInitialPrompt(prompt);
  };

  return (
    <>
      {sessionState == "startup" && (
        <HomeScreen initialPromptSubmitted={handleInitialPromptSubmitted} />
      )}
      {sessionState == "started" && (
        <CodingAgent session={session} userPrompt={initialPrompt} />
      )}
    </>
  );
};

const renderer = await createCliRenderer();
renderer.console.show();
createRoot(renderer).render(<App />);
