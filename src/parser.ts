import { TemplateError } from './errors';
import { Token } from './tokenizer';

export type ASTNodeType =
  | 'Text'
  | 'Interpolation'
  | 'Raw'
  | 'Comment'
  | 'Block'
  | 'Partial'
  | 'Delimiter';

export interface ASTNode {
  type: ASTNodeType;
  value: string;
  name?: string;
  expr?: string;
  inverted?: boolean;
  children?: ASTNode[];
  elseChildren?: ASTNode[];
  start: number;
  end: number;
}

interface StackFrame {
  node: ASTNode;
  inElse: boolean;
}

function preSplitTextTokens(tokens: Token[]): Token[] {
  const result: Token[] = [];
  for (const token of tokens) {
    if (token.type !== 'Text') {
      result.push(token);
      continue;
    }
    const val = token.value;
    let lastIdx = 0;
    let idx = val.indexOf('\n');
    while (idx !== -1) {
      if (idx > lastIdx) {
        const textVal = val.substring(lastIdx, idx);
        result.push({
          type: 'Text',
          value: textVal,
          start: token.start + lastIdx,
          end: token.start + idx,
        });
      }
      result.push({
        type: 'Text',
        value: '\n',
        start: token.start + idx,
        end: token.start + idx + 1,
      });
      lastIdx = idx + 1;
      idx = val.indexOf('\n', lastIdx);
    }
    if (lastIdx < val.length) {
      result.push({
        type: 'Text',
        value: val.substring(lastIdx),
        start: token.start + lastIdx,
        end: token.end,
      });
    }
  }
  return result;
}

function slurpWhitespace(tokens: Token[]): Token[] {
  const preSplit = preSplitTextTokens(tokens);
  const lines: Token[][] = [];
  let currentLine: Token[] = [];

  for (const token of preSplit) {
    if (token.type === 'Text' && token.value === '\n') {
      currentLine.push(token);
      lines.push(currentLine);
      currentLine = [];
    } else {
      currentLine.push(token);
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  const finalTokens: Token[] = [];
  for (const line of lines) {
    let hasStandaloneTag = false;
    let hasNonStandaloneTag = false;

    for (const token of line) {
      if (token.type === 'Interpolation' || token.type === 'Raw') {
        hasNonStandaloneTag = true;
      } else if (
        token.type === 'BlockStart' ||
        token.type === 'BlockEnd' ||
        token.type === 'Else' ||
        token.type === 'Comment' ||
        token.type === 'Delimiter' ||
        token.type === 'Partial'
      ) {
        hasStandaloneTag = true;
      } else if (token.type === 'Text') {
        if (token.value !== '\n' && /[^\s\t]/.test(token.value)) {
          hasNonStandaloneTag = true;
        }
      }
    }

    const isStandalone = hasStandaloneTag && !hasNonStandaloneTag;
    if (isStandalone) {
      for (const token of line) {
        if (token.type !== 'Text') {
          finalTokens.push(token);
        }
      }
    } else {
      finalTokens.push(...line);
    }
  }

  return squashTextTokens(finalTokens);
}

function squashTextTokens(tokens: Token[]): Token[] {
  const result: Token[] = [];
  let currentTextToken: Token | null = null;

  for (const token of tokens) {
    if (token.type === 'Text') {
      if (currentTextToken) {
        currentTextToken.value += token.value;
        currentTextToken.end = token.end;
      } else {
        currentTextToken = { ...token };
      }
    } else {
      if (currentTextToken) {
        result.push(currentTextToken);
        currentTextToken = null;
      }
      result.push(token);
    }
  }
  if (currentTextToken) {
    result.push(currentTextToken);
  }
  return result;
}

/**
 * Parses an array of tokens into an Abstract Syntax Tree (AST).
 *
 * @example
 * const tokens = tokenize('Hello {{name}}!');
 * const ast = parse(tokens);
 */
export function parse(tokens: Token[], template?: string): ASTNode[] {
  const cleanTokens = slurpWhitespace(tokens);

  const root: ASTNode[] = [];
  const stack: StackFrame[] = [];
  let currentChildren = root;

  for (const token of cleanTokens) {
    if (token.type === 'Text') {
      currentChildren.push({
        type: 'Text',
        value: token.value,
        start: token.start,
        end: token.end,
      });
    } else if (token.type === 'Interpolation') {
      currentChildren.push({
        type: 'Interpolation',
        value: token.value,
        expr: token.value,
        start: token.start,
        end: token.end,
      });
    } else if (token.type === 'Raw') {
      currentChildren.push({
        type: 'Raw',
        value: token.value,
        expr: token.value,
        start: token.start,
        end: token.end,
      });
    } else if (token.type === 'Comment') {
      currentChildren.push({
        type: 'Comment',
        value: token.value,
        start: token.start,
        end: token.end,
      });
    } else if (token.type === 'Partial') {
      currentChildren.push({
        type: 'Partial',
        value: token.value,
        expr: token.value,
        start: token.start,
        end: token.end,
      });
    } else if (token.type === 'Delimiter') {
      currentChildren.push({
        type: 'Delimiter',
        value: token.value,
        start: token.start,
        end: token.end,
      });
    } else if (token.type === 'BlockStart' || token.type === 'InvertedStart') {
      const blockNode: ASTNode = {
        type: 'Block',
        value: token.value,
        name: token.name,
        expr: token.expr,
        inverted: token.type === 'InvertedStart',
        children: [],
        elseChildren: [],
        start: token.start,
        end: token.end,
      };
      currentChildren.push(blockNode);
      stack.push({ node: blockNode, inElse: false });
      currentChildren = blockNode.children!;
    } else if (token.type === 'Else') {
      const topFrame = stack[stack.length - 1];
      if (!topFrame) {
        if (template) {
          throw new TemplateError('Orphaned else tag', template, token.start);
        }
        throw new Error(`Orphaned else tag at position ${token.start}`);
      }
      topFrame.inElse = true;
      currentChildren = topFrame.node.elseChildren!;
    } else if (token.type === 'BlockEnd') {
      const poppedFrame = stack.pop();
      if (!poppedFrame) {
        if (template) {
          throw new TemplateError(`Unopened section "${token.value}"`, template, token.start);
        }
        throw new Error(`Unopened section "${token.value}" at position ${token.start}`);
      }
      const openBlock = poppedFrame.node;

      if (
        token.value &&
        openBlock.name &&
        token.value !== openBlock.name &&
        token.value !== openBlock.expr
      ) {
        if (template) {
          throw new TemplateError(
            `Mismatched block end: expected "${openBlock.name || openBlock.expr}" but found "${token.value}"`,
            template,
            token.start
          );
        }
        throw new Error(
          `Mismatched block end: expected "${openBlock.name || openBlock.expr}" but found "${token.value}" at position ${token.start}`
        );
      }

      if (stack.length > 0) {
        const parentFrame = stack[stack.length - 1];
        if (parentFrame) {
          currentChildren = parentFrame.inElse
            ? parentFrame.node.elseChildren!
            : parentFrame.node.children!;
        }
      } else {
        currentChildren = root;
      }
    }
  }

  const unclosedFrame = stack.pop();
  if (unclosedFrame) {
    if (template) {
      throw new TemplateError(
        `Unclosed section "${unclosedFrame.node.name || unclosedFrame.node.expr}"`,
        template,
        unclosedFrame.node.start
      );
    }
    throw new Error(
      `Unclosed section "${unclosedFrame.node.name || unclosedFrame.node.expr}" starting at position ${unclosedFrame.node.start}`
    );
  }

  return root;
}
