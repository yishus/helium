#!/usr/bin/env bun
import { useState } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import { Session } from "./session";
import HomeScreen from "./components/HomeScreen";
import CodingAgent from "./components/CodingAgent";

const session = new Session();

interface AppProps {
  onExit: () => void;
}

const App = ({ onExit }: AppProps) => {
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
          onExit={onExit}
        />
      )}
      {sessionState == "started" && (
        <CodingAgent session={session} userPrompt={initialPrompt} onExit={onExit} />
      )}
    </>
  );
};

const renderer = await createCliRenderer();
renderer.console.show();

const handleExit = () => {
  renderer.destroy();
  process.exit(0);
};

createRoot(renderer).render(<App onExit={handleExit} />);
