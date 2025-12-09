import { createCliRenderer, type SubmitEvent } from "@opentui/core";
import { createRoot } from "@opentui/react";

function App() {
  const handleSubmit = (event: SubmitEvent) => {
    console.log("User submitted:", event);
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
        <ascii-font font="tiny" text="helium" />
        <box
          style={{
            border: true,
            width: "100%",
            flexDirection: "row",
          }}
        >
          <text>&gt; </text>
          <textarea
            placeholder="Type here..."
            onSubmit={handleSubmit}
            minHeight={1}
            maxHeight={6}
            focused
            flexGrow={1}
          />
        </box>
      </box>
    </box>
  );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
