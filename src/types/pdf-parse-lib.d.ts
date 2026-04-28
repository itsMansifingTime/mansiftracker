declare module "pdf-parse/lib/pdf-parse" {
  type PdfParseResult = { text: string };
  export default function pdf(
    dataBuffer: Buffer,
    options?: Record<string, unknown>
  ): Promise<PdfParseResult>;
}
