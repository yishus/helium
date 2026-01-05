import { useEffect, useState } from "react";
import { createCliRenderer, type KeyBinding } from "@opentui/core";
import { createRoot } from "@opentui/react";

function App() {
  const keyBindings: KeyBinding[] = [
    {
      name: "return",
      shift: true,
      action: "newline",
    },
    {
      name: "return",
      action: "submit",
    },
  ];

  const [popOverVisible, setPopOverVisible] = useState(false);
  const popoverOptions = [
    { name: "Option 1", description: "Option 1 description", value: "opt1" },
    { name: "Option 2", description: "Option 2 description", value: "opt2" },
    { name: "Option 3", description: "Option 3 description", value: "opt3" },
  ];

  useEffect(() => {
    renderer.console.show();
  }, [renderer]);

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
        {popOverVisible && (
          <box
            style={{
              border: true,
              height: 6,
              backgroundColor: "red",
              width: "100%",
            }}
          >
            <select
              style={{ height: 4 }}
              options={popoverOptions}
              focused={true}
              onChange={(index, option) => {
                console.log("Selected:", option);
              }}
            />
          </box>
        )}
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
            minHeight={1}
            maxHeight={6}
            focused
            flexGrow={1}
            keyBindings={keyBindings}
            onSubmit={() => {
              console.log("Submitted!");
            }}
          />
        </box>
      </box>
    </box>
  );
}

const renderer = await createCliRenderer();
createRoot(renderer).render(<App />);
