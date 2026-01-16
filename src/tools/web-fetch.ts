import { Type, type Static } from "typebox";
import turndown from "turndown";

import { Agent } from "../agent";
import type { Tool } from "./";

const description = `
 - Fetches content from a specified URL and processes it using an AI model
 - Takes a URL and a prompt as input
 - Fetches the URL content, converts HTML to markdown
 - Processes the content with the prompt using a small, fast model
 - Returns the model's response about the content
 - Use this tool when you need to retrieve and analyze web content
 `;

const webFetchSchema = Type.Object({
  url: Type.String({
    description: "The URL of the web page to fetch content from",
  }),
  prompt: Type.String({
    description: "The prompt to process the fetched content",
  }),
});

type argsType = Static<typeof webFetchSchema>;

const definition = {
  name: "webFetch",
  description,
  input_schema: webFetchSchema,
};

const callFunction = async (args: argsType) => {
  const { url, prompt } = args;
  const response = await fetch(url);
  if (response.redirected) {
    return `The URL was redirected to ${response.url}`;
  } else if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  } else {
    const td = new turndown();
    const markdown = td.turndown(response.text());
    const agent = new Agent();
    const agentMessage = await agent.prompt(`${prompt}\n\n${markdown}`);
    return agentMessage.text;
  }
};

export default { definition, callFunction } as Tool<typeof webFetchSchema>;
