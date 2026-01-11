import type { Static, TSchema } from "typebox";

import bash from "./bash";
import edit from "./edit";
import read from "./read";
import webFetch from "./web-fetch";
import write from "./write";

export interface Tool<T extends TSchema> {
  definition: {
    name: string;
    description: string;
    input_schema: T;
  };
  callFunction: (args: Static<T>) => Promise<string>;
}

export default { bash, edit, read, webFetch, write };
