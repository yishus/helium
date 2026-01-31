import { useEffect, useRef, useState } from "react";

import {
  Session,
  type ToolUseRequest,
  type UIMessage,
  type ModelId,
  ALL_MODELS,
  Provider,
} from "../session";
import ChatTextbox from "./ChatTextbox";
import Message from "./Message";
import ToolUseRequestDialog from "./ToolUseRequestDialog";
import ModelSelectorDialog from "./ModelSelectorDialog";

interface Props {
  session: Session;
  userPrompt: string;
}

const CodingAgent = (props: Props) => {
  const { session, userPrompt } = props;
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [tokenCost, setTokenCost] = useState(0);
  const [tokenUsage, setTokenUsage] = useState(0);
  const [showToolUseRequest, setShowToolUseRequest] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [currentModel, setCurrentModel] = useState<ModelId>(session.getModel());
  const [currentProvider, setCurrentProvider] = useState<Provider>(session.getProvider());
  const toolUseRequestRef = useRef<ToolUseRequest | null>(null);
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

  const handleToolUseSelect = (approved: boolean) => {
    pendingApprovalRef.current?.resolve(approved);
    pendingApprovalRef.current = null;
    setShowToolUseRequest(false);
  };

  const handleModelSelect = (model: ModelId, provider: Provider) => {
    session.setModel(model, provider);
    setCurrentModel(model);
    setCurrentProvider(provider);
    const modelInfo = ALL_MODELS.find((m) => m.id === model);
    const providerName = provider === Provider.Anthropic ? "Anthropic" : provider === Provider.OpenAI ? "OpenAI" : "Google";
    const modelName = modelInfo?.name ?? model;
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: `Model changed to ${modelName} (${providerName})` },
    ]);
    setShowModelSelector(false);
  };

  const handleModelCancel = () => {
    setShowModelSelector(false);
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

  const currentModelName =
    ALL_MODELS.find((m) => m.id === currentModel)?.name ?? "Unknown";
  const currentProviderName =
    currentProvider === Provider.Anthropic ? "Anthropic" : currentProvider === Provider.OpenAI ? "OpenAI" : "Google";

  return (
    <box style={{ flexDirection: "row", width: "100%", height: "100%" }}>
      <box style={{ width: "75%", border: true, flexDirection: "column" }}>
        <scrollbox
          style={{ flexGrow: 1 }}
          stickyScroll={true}
          stickyStart="bottom"
        >
          {messages.map((message, index) => (
            <Message key={index} message={message} index={index} />
          ))}
          {showToolUseRequest && toolUseRequestRef.current && (
            <ToolUseRequestDialog
              request={toolUseRequestRef.current}
              session={session}
              onSelect={handleToolUseSelect}
            />
          )}
          {showModelSelector && (
            <ModelSelectorDialog
              currentModel={currentModel}
              onSelect={handleModelSelect}
              onCancel={handleModelCancel}
            />
          )}
        </scrollbox>
        <ChatTextbox onSubmit={handleSubmit} minHeight={3} />
      </box>
      <box style={{ width: "25%", border: true, flexDirection: "column" }}>
        <text>Provider: {currentProviderName}</text>
        <text>Model: {currentModelName}</text>
        <text>Tokens used: {tokenUsage}</text>
        <text>Cost: ${tokenCost.toFixed(6)}</text>
      </box>
    </box>
  );
};

export default CodingAgent;
