import { GoDaddyValidationError } from "@godaddy-toolkit/sdk";

interface PromptInput {
  readonly isTTY?: boolean;
  readonly isRaw?: boolean;
  setRawMode?(mode: boolean): unknown;
  setEncoding(encoding: "utf8"): unknown;
  resume(): unknown;
  pause(): unknown;
  on(event: "data", listener: (chunk: string) => void): unknown;
  once(event: "end" | "error", listener: () => void): unknown;
  off(event: string, listener: (...args: any[]) => void): unknown;
}

export interface PromptIO {
  stdin: PromptInput;
  stderr: { write(text: string): unknown };
}

export function stdinIsInteractive(
  input: PromptInput = process.stdin,
): boolean {
  return Boolean(input.isTTY && typeof input.setRawMode === "function");
}

/** Read hidden terminal input; injected streams keep tests off the real terminal. */
export function promptHidden(
  label: string,
  io: PromptIO = process,
): Promise<string> {
  const { stdin, stderr } = io;
  if (!stdinIsInteractive(stdin)) {
    return Promise.reject(
      new GoDaddyValidationError(
        "No terminal to prompt on; pipe a value with --stdin.",
      ),
    );
  }
  const wasRaw = Boolean(stdin.isRaw);
  return new Promise((resolve, reject) => {
    let value = "";
    let finished = false;
    const onEnd = () => finish();
    const onError = () =>
      finish(
        new GoDaddyValidationError(
          "Could not read terminal; nothing was stored",
        ),
      );
    const finish = (error?: GoDaddyValidationError) => {
      if (finished) return;
      finished = true;
      stdin.off("data", onData);
      stdin.off("end", onEnd);
      stdin.off("error", onError);
      try {
        stdin.setRawMode!(wasRaw);
      } catch {
        error ??= new GoDaddyValidationError(
          "Could not restore terminal; nothing was stored",
        );
      } finally {
        stdin.pause();
        stderr.write("\n");
      }
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      // A paste can arrive in one multi-character chunk.
      for (const char of chunk) {
        if (char === "\r" || char === "\n" || char === "\u0004")
          return finish();
        if (char === "\u0003") {
          return finish(
            new GoDaddyValidationError("Cancelled; nothing was stored"),
          );
        }
        if (char === "\u007f" || char === "\b") {
          value = Array.from(value).slice(0, -1).join("");
          continue;
        }
        value += char;
      }
    };
    stdin.on("data", onData);
    stdin.once("end", onEnd);
    stdin.once("error", onError);
    try {
      stderr.write(label);
      stdin.setRawMode!(true);
      stdin.setEncoding("utf8");
      stdin.resume();
    } catch {
      onError();
    }
  });
}

/** Read explicit piped input; callers trim and validate before storing. */
export async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
