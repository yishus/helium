export const isPrintableASCII = (str: string) => /^[\x20-\x7E]*$/.test(str);
