import { TemplateError } from './errors';
import { escapeRegExp } from './utils';

export type TokenType =
  | 'Text'
  | 'Interpolation'
  | 'Raw'
  | 'Comment'
  | 'BlockStart'
  | 'BlockEnd'
  | 'InvertedStart'
  | 'Else'
  | 'Partial'
  | 'Delimiter';

export interface Token {
  type: TokenType;
  value: string;
  name?: string;
  expr?: string;
  start: number;
  end: number;
}

class Scanner {
  #string: string;
  #tail: string;
  #pos: number;

  constructor(string: string) {
    this.#string = string;
    this.#tail = string;
    this.#pos = 0;
  }

  get pos(): number {
    return this.#pos;
  }

  get string(): string {
    return this.#string;
  }

  eos(): boolean {
    return this.#tail === '';
  }

  scan(re: RegExp): string {
    const match = this.#tail.match(re);
    if (!match || match.index !== 0) {
      return '';
    }
    const str = match[0];
    this.#tail = this.#tail.substring(str.length);
    this.#pos += str.length;
    return str;
  }

  scanUntil(re: RegExp): string {
    const index = this.#tail.search(re);
    let match = '';
    switch (index) {
      case -1:
        match = this.#tail;
        this.#tail = '';
        break;
      case 0:
        match = '';
        break;
      default:
        match = this.#tail.substring(0, index);
        this.#tail = this.#tail.substring(index);
    }
    this.#pos += match.length;
    return match;
  }
}

const spaceRe = /\s+/;
const equalsRe = /\s*=/;

/**
 * Tokenizes a template string into syntactic elements using configurable delimiters.
 *
 * @example
 * const tokens = tokenize('Hello {{name}}!');
 */
export function tokenize(template: string, initialTags: [string, string] = ['{{', '}}']): Token[] {
  if (!template) {
    return [];
  }

  const tokens: Token[] = [];
  const scanner = new Scanner(template);

  let currentTags = [...initialTags] as [string, string];
  let openingTagRe!: RegExp;
  let closingTagRe!: RegExp;
  let closingCurlyRe!: RegExp;

  function compileTags(tags: [string, string]) {
    openingTagRe = new RegExp(escapeRegExp(tags[0]) + '\\s*');
    closingTagRe = new RegExp('\\s*' + escapeRegExp(tags[1]));
    closingCurlyRe = new RegExp('\\s*' + escapeRegExp('}' + tags[1]));
  }

  compileTags(currentTags);

  while (!scanner.eos()) {
    const start = scanner.pos;

    // Scan everything up to the next opening tag
    const textValue = scanner.scanUntil(openingTagRe);
    if (textValue) {
      tokens.push({
        type: 'Text',
        value: textValue,
        start,
        end: scanner.pos,
      });
    }

    // Attempt to match the opening tag
    if (!scanner.scan(openingTagRe)) {
      break;
    }

    const tagStartPos = scanner.pos - currentTags[0].length;

    // Check if it is a block, inverted, partial, raw, comment, delimiter change, or standard tag
    let type: TokenType = 'Interpolation';
    let rawContent = '';

    // Look at first character of the tag
    const firstChar = scanner.scan(/#|\^|\/|>|\{|&|=|!/);

    if (firstChar === '!') {
      type = 'Comment';
      rawContent = scanner.scanUntil(closingTagRe);
    } else if (firstChar === '#') {
      type = 'BlockStart';
      rawContent = scanner.scanUntil(closingTagRe);
    } else if (firstChar === '^') {
      // Inverted start can be empty, i.e., {{^}} or have an expression {{^expr}}
      // Wait, let's read until closing tag to check if it's empty or has expression
      const remainder = scanner.scanUntil(closingTagRe);
      if (remainder.trim() === '') {
        type = 'Else';
      } else {
        type = 'InvertedStart';
      }
      rawContent = remainder;
    } else if (firstChar === '/') {
      type = 'BlockEnd';
      rawContent = scanner.scanUntil(closingTagRe);
    } else if (firstChar === '>') {
      type = 'Partial';
      rawContent = scanner.scanUntil(closingTagRe);
    } else if (firstChar === '=') {
      type = 'Delimiter';
      rawContent = scanner.scanUntil(equalsRe);
      scanner.scan(equalsRe);
      scanner.scanUntil(closingTagRe);
    } else if (firstChar === '{') {
      type = 'Raw';
      rawContent = scanner.scanUntil(closingCurlyRe);
      scanner.scan(/\s*\}/); // consume the extra closing curly
    } else if (firstChar === '&') {
      type = 'Raw';
      rawContent = scanner.scanUntil(closingTagRe);
    } else {
      // Standard interpolation
      const val = scanner.scanUntil(closingTagRe);
      if (val.trim() === 'else') {
        type = 'Else';
      } else {
        type = 'Interpolation';
      }
      rawContent = val;
    }

    // Match the closing tag
    if (!scanner.scan(closingTagRe)) {
      throw new TemplateError('Unclosed tag', template, scanner.pos);
    }

    const end = scanner.pos;
    const trimmedContent = rawContent.trim();

    if (type === 'Delimiter') {
      // Set the tags for the next time around
      const tagsToCompile = trimmedContent.split(spaceRe);
      if (tagsToCompile.length !== 2) {
        throw new TemplateError('Invalid delimiter change tag', template, start);
      }
      const tagOpen = tagsToCompile[0];
      const tagClose = tagsToCompile[1];
      if (tagOpen === undefined || tagClose === undefined) {
        throw new TemplateError('Invalid delimiter change tag', template, start);
      }
      currentTags = [tagOpen, tagClose];
      compileTags(currentTags);

      tokens.push({
        type: 'Delimiter',
        value: trimmedContent,
        start: tagStartPos,
        end,
      });
    } else if (type === 'BlockStart' || type === 'InvertedStart') {
      // Parse block start: name (e.g. "if", "each") and expression (e.g. "user.isLoggedIn")
      // Example: {{#if user.isLoggedIn}} -> name is "if", expr is "user.isLoggedIn"
      // Example: {{#items}} -> name is undefined, expr is "items"
      const parts = trimmedContent.split(spaceRe);
      const possibleName = parts[0];
      if (
        possibleName === 'if' ||
        possibleName === 'each' ||
        possibleName === 'unless' ||
        possibleName === 'with'
      ) {
        tokens.push({
          type,
          value: trimmedContent,
          name: possibleName,
          expr: trimmedContent.substring(possibleName.length).trim(),
          start: tagStartPos,
          end,
        });
      } else {
        tokens.push({
          type,
          value: trimmedContent,
          expr: trimmedContent,
          start: tagStartPos,
          end,
        });
      }
    } else if (type === 'BlockEnd') {
      tokens.push({
        type,
        value: trimmedContent,
        start: tagStartPos,
        end,
      });
    } else if (type === 'Else') {
      tokens.push({
        type: 'Else',
        value: trimmedContent,
        start: tagStartPos,
        end,
      });
    } else {
      tokens.push({
        type,
        value: trimmedContent,
        start: tagStartPos,
        end,
      });
    }
  }

  return tokens;
}
