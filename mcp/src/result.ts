export interface ToolTextContent {
  type: "text";
  text: string;
}

export interface ToolImageContent {
  type: "image";
  data: string;
  mimeType: string;
}

export type ToolContent = ToolTextContent | ToolImageContent;

export interface ToolExecutionResult {
  [key: string]: unknown;
  content: ToolContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function createToolResult(
  text: string,
  structuredContent?: Record<string, unknown>,
  isError = false,
): ToolExecutionResult {
  return {
    content: [{ type: "text", text }],
    ...(structuredContent ? { structuredContent } : {}),
    ...(isError ? { isError: true } : {}),
  };
}

export function createToolError(error: unknown, context?: Record<string, unknown>): ToolExecutionResult {
  return createToolResult(
    `Failed: ${toErrorMessage(error)}`,
    { status: "error", ...context },
    true,
  );
}
