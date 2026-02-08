declare module "mammoth/mammoth.browser" {
  interface ConvertOptions {
    styleMap?: string[];
  }

  interface ConvertResult {
    value: string;
    messages: Array<{
      type: string;
      message: string;
    }>;
  }

  interface ArrayBufferInput {
    arrayBuffer: ArrayBuffer;
  }

  export function convertToMarkdown(
    input: ArrayBufferInput,
    options?: ConvertOptions,
  ): Promise<ConvertResult>;

  export function convertToHtml(
    input: ArrayBufferInput,
    options?: ConvertOptions,
  ): Promise<ConvertResult>;
}
