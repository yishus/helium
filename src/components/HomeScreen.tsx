import ChatTextbox from "./ChatTextbox";

interface Props {
  initialPromptSubmitted: (prompt: string) => void;
  onExit: () => void;
}

const HomeScreen = (props: Props) => {
  const { initialPromptSubmitted, onExit } = props;

  const handleSubmit = (submittedText: string) => {
    if (submittedText === "/exit" || submittedText === "exit") {
      onExit();
      return;
    }
    initialPromptSubmitted(submittedText);
  };

  return (
    <box
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexGrow: 1,
      }}
    >
      <box
        style={{
          justifyContent: "center",
          alignItems: "center",
          minWidth: 60,
          width: "50%",
        }}
      >
        <ascii-font font="tiny" text="helium" style={{ marginBottom: 1 }} />

        <ChatTextbox onSubmit={handleSubmit} minHeight={2} />
      </box>
    </box>
  );
};

export default HomeScreen;
