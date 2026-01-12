import { Session } from "../session";
import ChatTextbox from "./ChatTextbox";

interface Props {
  initialPromptSubmitted: (prompt: string) => void;
  session: Session;
}

const HomeScreen = (props: Props) => {
  const { initialPromptSubmitted, session } = props;

  const handleSubmit = (submittedText: string) => {
    session.prompt(submittedText);
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
          minWidth: 50,
          width: "50%",
        }}
      >
        <ascii-font font="tiny" text="helium" style={{ marginBottom: 2 }} />
        <ChatTextbox onSubmit={handleSubmit} minHeight={1} />
      </box>
    </box>
  );
};

export default HomeScreen;
