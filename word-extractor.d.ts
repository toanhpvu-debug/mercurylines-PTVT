declare module "word-extractor" {
  class Document {
    getBody(): string;
    /** Chữ của header (kèm footer trừ khi includeFooters: false). */
    getHeaders(options?: { includeFooters?: boolean }): string;
    getFooters(): string;
  }
  export default class WordExtractor {
    extract(source: string | Buffer): Promise<Document>;
  }
}
