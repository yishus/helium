import type { Static, TSchema } from "typebox";

import read from "./read";
import webFetch from "./web-fetch";

export interface Tool<T extends TSchema> {
  definition: {
    name: string;
    description: string;
    input_schema: T;
  };
  callFunction: (args: Static<T>) => Promise<string>;
}

export default { read, webFetch };
