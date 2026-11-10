import { outputFlags, formatOutput, type OutputFlags } from "../output.js";
import { handleError } from "../handle-error.js";
export interface AuthOutputFlags extends OutputFlags {
  readonly text: boolean;
}
export const authOutputFlags = {
  ...outputFlags,
  text: {
    kind: "boolean" as const,
    brief: "Output readable text",
    default: false,
  },
};
export function emitAuth(
  data: unknown,
  flags: AuthOutputFlags,
  text: () => string,
): void {
  console.log(
    flags.text && !flags.json && !flags.csv
      ? text()
      : formatOutput(data, flags),
  );
}
export async function runAuth(work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (error) {
    handleError(error);
  }
}
