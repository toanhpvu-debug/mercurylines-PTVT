declare module "word-extractor" {
  class Document {
    getBody(): string;
  }
  export default class WordExtractor {
    extract(source: string | Buffer): Promise<Document>;
  }
}
