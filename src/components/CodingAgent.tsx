import { useEffect, useRef, useState } from "react";

import {
  Session,
  type ToolUseRequest,
  type AskUserQuestionRequest,
  type UIMessage,
  type ModelId,
  type QuestionAnswer,
  ALL_MODELS,
  Provider,
} from "../session";
import ChatTextbox from "./ChatTextbox";
import Message from "./Message";
import ToolUseRequestDialog from "./ToolUseRequestDialog";
import AskUserQuestionDialog from "./AskUserQuestionDialog";
import ModelSelectorDialog from "./ModelSelectorDialog";
import { THEME } from "../theme";
import type { AskUserQuestionInput } from "../tools";

interface Props {
  session: Session;
  userPrompt: string;
  onExit: () => void;
}

const CodingAgent = (props: Props) => {
  const { session, userPrompt, onExit } = props;
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [tokenCost, setTokenCost] = useState(0);
  const [inputTokens, setInputTokens] = useState(0);
  const [outputTokens, setOutputTokens] = useState(0);
  const [showToolUseRequest, setShowToolUseRequest] = useState(false);
  const [showAskUserQuestion, setShowAskUserQuestion] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [currentModel, setCurrentModel] = useState<ModelId>(session.getModel());
  const [currentProvider, setCurrentProvider] = useState<Provider>(
    session.getProvider(),
  );
  const toolUseRequestRef = useRef<ToolUseRequest | null>(null);
  const askUserQuestionRef = useRef<AskUserQuestionInput | null>(null);
  const pendingApprovalRef = useRef<{
    resolve: (approved: boolean) => void;
  } | null>(null);
  const pendingAskUserQuestionRef = useRef<{
    resolve: (answers: QuestionAnswer[]) => void;
  } | null>(null);

  useEffect(() => {
    session.canUseToolHandler = async (request: ToolUseRequest) => {
      toolUseRequestRef.current = request;
      setShowToolUseRequest(true);

      return new Promise<boolean>((resolve) => {
        pendingApprovalRef.current = { resolve };
      });
    };

    session.askUserQuestionHandler = async (
      request: AskUserQuestionRequest,
    ) => {
      askUserQuestionRef.current = request.input;
      setShowAskUserQuestion(true);

      return new Promise<QuestionAnswer[]>((resolve) => {
        pendingAskUserQuestionRef.current = { resolve };
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
      setInputTokens(event.input_tokens ?? 0);
      setOutputTokens(event.output_tokens ?? 0);
    });

    handleSubmit(userPrompt);
  }, []);

  const handleToolUseSelect = (approved: boolean) => {
    pendingApprovalRef.current?.resolve(approved);
    pendingApprovalRef.current = null;
    setShowToolUseRequest(false);
  };

  const handleAskUserQuestionSubmit = (answers: QuestionAnswer[]) => {
    pendingAskUserQuestionRef.current?.resolve(answers);
    pendingAskUserQuestionRef.current = null;
    setShowAskUserQuestion(false);
  };

  const handleAskUserQuestionCancel = () => {
    pendingAskUserQuestionRef.current?.resolve([]);
    pendingAskUserQuestionRef.current = null;
    setShowAskUserQuestion(false);
  };

  const handleModelSelect = (model: ModelId, provider: Provider) => {
    session.setModel(model, provider);
    setCurrentModel(model);
    setCurrentProvider(provider);
    const modelInfo = ALL_MODELS.find((m) => m.id === model);
    const providerName =
      provider === Provider.Anthropic
        ? "Anthropic"
        : provider === Provider.OpenAI
          ? "OpenAI"
          : "Google";
    const modelName = modelInfo?.name ?? model;
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text: `Model changed to ${modelName} (${providerName})`,
      },
    ]);
    setShowModelSelector(false);
  };

  const handleModelCancel = () => {
    setShowModelSelector(false);
  };

  const handleSubmit = (submittedText: string) => {
    if (submittedText === "/exit" || submittedText === "exit") {
      onExit();
      return;
    }
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
    currentProvider === Provider.Anthropic
      ? "Anthropic"
      : currentProvider === Provider.OpenAI
        ? "OpenAI"
        : "Google";

  return (
    <box style={{ padding: 1 }}>
      <scrollbox
        style={{ flexGrow: 1, padding: 1 }}
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
        {showAskUserQuestion && askUserQuestionRef.current && (
          <AskUserQuestionDialog
            input={askUserQuestionRef.current}
            onSubmit={handleAskUserQuestionSubmit}
            onCancel={handleAskUserQuestionCancel}
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
      <ChatTextbox onSubmit={handleSubmit} minHeight={6} />
      <box
        style={{
          flexDirection: "row",
        }}
      >
        <text fg={THEME.colors.text.muted} style={{ marginRight: 1 }}>
          Provider
        </text>
        <text fg={THEME.colors.text.primary} style={{ marginRight: 1 }}>
          {currentProviderName}
        </text>

        <text fg={THEME.colors.text.muted} style={{ marginRight: 1 }}>
          Model
        </text>
        <text fg={THEME.colors.text.primary} style={{ marginRight: 1 }}>
          {currentModelName}
        </text>

        <text fg={THEME.colors.text.muted} style={{ marginRight: 1 }}>
          Input Tokens
        </text>
        <text fg={THEME.colors.text.primary} style={{ marginRight: 1 }}>
          {inputTokens}
        </text>

        <text fg={THEME.colors.text.muted} style={{ marginRight: 1 }}>
          Output Tokens
        </text>
        <text fg={THEME.colors.text.primary} style={{ marginRight: 1 }}>
          {outputTokens}
        </text>

        <text fg={THEME.colors.text.muted} style={{ marginRight: 1 }}>
          Total Cost
        </text>
        <text fg={THEME.colors.text.primary}>${tokenCost.toFixed(6)}</text>
      </box>
    </box>
  );
};

export default CodingAgent;
