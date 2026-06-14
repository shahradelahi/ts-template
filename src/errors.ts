/**
 * Gets the 1-based line and column of a character position in a template string.
 */
export function getLineAndColumn(template: string, pos: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  for (let i = 0; i < pos; i++) {
    if (template[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

/**
 * Generates a visual code frame indicating the location of an error in a template.
 *
 * @example
 * const frame = generateCodeFrame('Hello {{name', 12, 'Unclosed tag');
 * // Output:
 * // Error: Unclosed tag
 * //   at template:1:13
 * // > 1 | Hello {{name
 * //     |             ^
 */
export function generateCodeFrame(template: string, pos: number, message: string): string {
  const { line, column } = getLineAndColumn(template, pos);
  const lines = template.split('\n');

  const startLine = Math.max(1, line - 2);
  const endLine = Math.min(lines.length, line + 2);

  let frame = `Error: ${message}\n`;
  frame += `  at template:${line}:${column}\n\n`;

  const maxLineNumLength = String(endLine).length;

  for (let l = startLine; l <= endLine; l++) {
    const lineContent = lines[l - 1];
    if (lineContent === undefined) {
      continue;
    }
    const isErrorLine = l === line;
    const prefix = isErrorLine ? '> ' : '  ';
    const lineNumStr = String(l).padStart(maxLineNumLength, ' ');
    frame += `${prefix}${lineNumStr} | ${lineContent}\n`;
    if (isErrorLine) {
      const padding = ' '.repeat(maxLineNumLength);
      const indent = ' '.repeat(column - 1);
      frame += `  ${padding} | ${indent}^\n`;
    }
  }
  return frame;
}

/**
 * Represents a template compilation or parsing error with a visual code frame.
 *
 * @example
 * throw new TemplateError('Unclosed tag', 'Hello {{name', 12);
 */
export class TemplateError extends Error {
  override name = 'TemplateError';
  pos: number;
  template: string;
  originalMessage: string;

  constructor(message: string, template: string, pos: number) {
    const frame = generateCodeFrame(template, pos, message);
    super(frame);
    this.pos = pos;
    this.template = template;
    this.originalMessage = message;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
