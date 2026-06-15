const BLACKLIST = new Set(['__proto__', 'constructor', 'prototype']);

const entityMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escapes HTML special characters in a string to prevent XSS attacks.
 *
 * @example
 * const escaped = escapeHtml('<script>alert(1)</script>');
 */
export function escapeHtml(string: any): string {
  if (string === null || string === undefined) {
    return '';
  }
  return String(string).replace(/[&<>"'`=/]/g, (s) => entityMap[s] ?? '');
}

/**
 * Escapes special characters for use in regular expressions.
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * Safely retrieves a nested property value from an object using a dot-notation path.
 *
 * @example
 * const value = getPropertyValue({ user: { name: 'Alice' } }, 'user.name');
 */
export function getPropertyValue(obj: any, path: string): any {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  const parts = path.replace(/\?/g, '').split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (BLACKLIST.has(part)) {
      return undefined;
    }

    if (typeof current !== 'object' && typeof current !== 'function') {
      try {
        current = (current as any)[part];
      } catch {
        return undefined;
      }
    } else {
      if (part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
  }

  if (typeof current === 'function') {
    let parentObj = obj;
    if (parts.length > 1) {
      parentObj = getPropertyValue(obj, parts.slice(0, -1).join('.'));
    }
    return current.call(parentObj);
  }

  return current;
}

/**
 * Parses primitive literal values (like strings, booleans, null, or numbers) from a string.
 */
export function parseLiteral(val: string): any {
  const trimmed = val.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (trimmed === 'undefined') return undefined;
  if (!isNaN(Number(trimmed)) && trimmed !== '') return Number(trimmed);
  return undefined;
}

export interface ParsedFilter {
  name: string;
  args: any[];
}

export interface ParsedExpression {
  baseExpr: string;
  filters: ParsedFilter[];
}

/**
 * Parses an expression and its piped filter chain.
 *
 * @example
 * const parsed = parseExpressionAndFilters('name | trim | default("Guest")');
 */
export function parseExpressionAndFilters(expr: string): ParsedExpression {
  const parts: string[] = [];
  let current = '';
  let inQuote: string | null = null;
  let i = 0;

  while (i < expr.length) {
    const char = expr[i];
    if (inQuote) {
      if (char === inQuote && expr[i - 1] !== '\\') {
        inQuote = null;
      }
      current += char;
      i++;
    } else if (char === "'" || char === '"') {
      inQuote = char;
      current += char;
      i++;
    } else if (char === '|' && expr[i + 1] !== '|' && expr[i - 1] !== '|') {
      parts.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }
  if (current) {
    parts.push(current.trim());
  }

  const baseExpr = parts[0] || '';
  const filters: ParsedFilter[] = [];

  for (let k = 1; k < parts.length; k++) {
    const filterPart = parts[k];
    if (filterPart === undefined) {
      continue;
    }
    const filterStr = filterPart.trim();
    if (!filterStr) continue;

    const parenIndex = filterStr.indexOf('(');
    if (parenIndex !== -1 && filterStr.endsWith(')')) {
      const name = filterStr.substring(0, parenIndex).trim();
      const argsStr = filterStr.substring(parenIndex + 1, filterStr.length - 1).trim();

      const args: any[] = [];
      let argCurrent = '';
      let argInQuote: string | null = null;
      let argIdx = 0;

      while (argIdx < argsStr.length) {
        const char = argsStr[argIdx];
        if (argInQuote) {
          if (char === argInQuote && argsStr[argIdx - 1] !== '\\') {
            argInQuote = null;
          }
          argCurrent += char;
          argIdx++;
        } else if (char === "'" || char === '"') {
          argInQuote = char;
          argCurrent += char;
          argIdx++;
        } else if (char === ',') {
          args.push(parseLiteralOrString(argCurrent.trim()));
          argCurrent = '';
          argIdx++;
        } else {
          argCurrent += char;
          argIdx++;
        }
      }
      if (argCurrent) {
        args.push(parseLiteralOrString(argCurrent.trim()));
      }

      filters.push({ name, args });
    } else {
      filters.push({ name: filterStr, args: [] });
    }
  }

  return { baseExpr, filters };
}

function parseLiteralOrString(val: string): any {
  const lit = parseLiteral(val);
  if (lit !== undefined) return lit;
  return val;
}

/**
 * Built-in template filters such as capitalize, upper, lower, trim, and default.
 */
export const BUILT_IN_FILTERS: Record<string, (val: any, ...args: any[]) => any> = {
  capitalize: (val) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    return s.charAt(0).toUpperCase() + s.slice(1);
  },
  upper: (val) => (val === null || val === undefined ? '' : String(val).toUpperCase()),
  uppercase: (val) => (val === null || val === undefined ? '' : String(val).toUpperCase()),
  lower: (val) => (val === null || val === undefined ? '' : String(val).toLowerCase()),
  lowercase: (val) => (val === null || val === undefined ? '' : String(val).toLowerCase()),
  trim: (val) => (val === null || val === undefined ? '' : String(val).trim()),
  json: (val) => JSON.stringify(val),
  default: (val, fallbackVal) =>
    val === null || val === undefined || val === '' ? fallbackVal : val,
  fallback: (val, fallbackVal) =>
    val === null || val === undefined || val === '' ? fallbackVal : val,
};

/**
 * Context object managing data lookup, parent fallback scopes, and metadata for rendering.
 *
 * @example
 * const ctx = new Context({ name: 'World' });
 * const value = ctx.lookup('name');
 */
export class Context {
  #view: any;
  #parent: Context | null;
  #cache: Record<string, any>;
  #meta: Record<string, any> | null;

  constructor(view: any, parent: Context | null = null, meta: Record<string, any> | null = null) {
    this.#view = view;
    this.#parent = parent;
    this.#cache = Object.create(null);
    this.#meta = meta;
  }

  get view(): any {
    return this.#view;
  }

  get parent(): Context | null {
    return this.#parent;
  }

  get meta(): Record<string, any> | null {
    return this.#meta;
  }

  push(view: any, meta: Record<string, any> | null = null): Context {
    return new Context(view, this, meta);
  }

  lookup(path: string): any {
    if (path === '.' || path === 'this') {
      return this.#view;
    }

    if (this.#cache[path] !== undefined) {
      return this.#cache[path];
    }

    if (path.startsWith('@')) {
      if (this.#meta && path in this.#meta) {
        return this.#meta[path];
      }
      let currentContext = this.#parent;
      while (currentContext) {
        const meta = currentContext.meta;
        if (meta && path in meta) {
          return meta[path];
        }
        currentContext = currentContext.parent;
      }
      return undefined;
    }

    let foundValue: any = undefined;
    let resolved = false;

    let lookupPath = path;
    if (path.startsWith('../')) {
      let parentCtx = this.#parent;
      lookupPath = path.substring(3);
      while (lookupPath.startsWith('../') && parentCtx) {
        parentCtx = parentCtx.parent;
        lookupPath = lookupPath.substring(3);
      }
      if (parentCtx) {
        foundValue = parentCtx.lookup(lookupPath);
        resolved = true;
      } else {
        foundValue = undefined;
        resolved = true;
      }
    }

    if (!resolved) {
      // First check this context
      const val = this.#view;
      if (val !== null && val !== undefined) {
        const res = getPropertyValue(val, lookupPath);
        if (res !== undefined) {
          foundValue = res;
          resolved = true;
        }
      }

      if (!resolved) {
        let currentContext = this.#parent;
        while (currentContext) {
          const pVal = currentContext.#view;
          if (pVal !== null && pVal !== undefined) {
            const res = getPropertyValue(pVal, lookupPath);
            if (res !== undefined) {
              foundValue = res;
              break;
            }
          }
          currentContext = currentContext.#parent;
        }
      }
    }

    this.#cache[path] = foundValue;
    return foundValue;
  }
}

/**
 * Evaluates an expression supporting logical fallbacks and nullish coalescing.
 *
 * @example
 * const result = evaluateExpression(ctx, 'user.nickname ?? user.name ?? "Guest"');
 */
export function evaluateExpression(ctx: Context, expr: string): any {
  const trimmed = expr.trim();
  if (!trimmed) {
    return undefined;
  }

  const tokens: { value: string; op?: '??' | '||' }[] = [];
  let current = '';
  let inQuote: string | null = null;
  let i = 0;

  while (i < trimmed.length) {
    const char = trimmed[i];
    if (inQuote) {
      if (char === inQuote && trimmed[i - 1] !== '\\') {
        inQuote = null;
      }
      current += char;
      i++;
    } else if (char === "'" || char === '"') {
      inQuote = char;
      current += char;
      i++;
    } else if (char === '?' && trimmed[i + 1] === '?') {
      tokens.push({ value: current.trim() });
      tokens.push({ value: '??', op: '??' });
      current = '';
      i += 2;
    } else if (char === '|' && trimmed[i + 1] === '|') {
      tokens.push({ value: current.trim() });
      tokens.push({ value: '||', op: '||' });
      current = '';
      i += 2;
    } else {
      current += char;
      i++;
    }
  }
  if (current) {
    tokens.push({ value: current.trim() });
  }

  if (tokens.length === 0) {
    return undefined;
  }

  const firstToken = tokens[0];
  if (!firstToken) {
    return undefined;
  }
  let result = resolveOperand(ctx, firstToken.value);

  let idx = 1;
  while (idx < tokens.length) {
    const token = tokens[idx];
    if (!token) break;
    const op = token.op;
    const nextToken = tokens[idx + 1];
    const nextValStr = nextToken?.value;
    if (!op || !nextValStr) break;

    if (op === '??') {
      if (result !== null && result !== undefined) {
        return result;
      }
      result = resolveOperand(ctx, nextValStr);
    } else if (op === '||') {
      if (result) {
        return result;
      }
      result = resolveOperand(ctx, nextValStr);
    }
    idx += 2;
  }

  return result;
}

function resolveOperand(ctx: Context, operand: string): any {
  const literal = parseLiteral(operand);
  if (literal !== undefined) return literal;
  if (operand === '') return undefined;
  return ctx.lookup(operand);
}

export interface GlobalConfig {
  filters: Record<string, (val: any, ...args: any[]) => any>;
  partials: Record<string, any> | ((name: string) => any);
  cacheSize: number;
  strict: boolean;
}

/**
 * Global configuration settings for the template engine.
 */
export const globalConfig: GlobalConfig = {
  filters: {},
  partials: {},
  cacheSize: 500,
  strict: false,
};

type ConfigListener = (config: GlobalConfig) => void;
const configListeners: ConfigListener[] = [];

/**
 * Registers a callback listener triggered when global configuration changes.
 */
export function registerConfigListener(listener: ConfigListener): void {
  configListeners.push(listener);
}

/**
 * Updates the global configuration of the template engine.
 *
 * @example
 * configure({ strict: true, cacheSize: 1000 });
 */
export function configure(options: Partial<GlobalConfig>): void {
  if (options.filters) {
    globalConfig.filters = { ...globalConfig.filters, ...options.filters };
  }
  if (options.partials !== undefined) {
    globalConfig.partials = options.partials;
  }
  if (options.cacheSize !== undefined) {
    globalConfig.cacheSize = options.cacheSize;
  }
  if (options.strict !== undefined) {
    globalConfig.strict = options.strict;
  }
  for (const listener of configListeners) {
    listener(globalConfig);
  }
}

/**
 * Evaluates an expression and applies its filters synchronously.
 *
 * @example
 * const value = evaluateExpressionWithFilters(ctx, 'name | capitalize');
 */
export function evaluateExpressionWithFilters(ctx: Context, expr: string, options: any = {}): any {
  const { baseExpr, filters } = parseExpressionAndFilters(expr);
  let value = evaluateExpression(ctx, baseExpr);

  const isStrict = options && options.strict !== undefined ? options.strict : globalConfig.strict;

  if (isStrict && value === undefined) {
    const isLit = parseLiteral(baseExpr) !== undefined;
    if (!isLit && baseExpr !== '') {
      throw new Error(`Strict Mode: Variable "${baseExpr}" is undefined`);
    }
  }

  for (const filter of filters) {
    const fn =
      (options && options.filters?.[filter.name]) ||
      globalConfig.filters[filter.name] ||
      BUILT_IN_FILTERS[filter.name];
    if (fn) {
      value = fn(value, ...filter.args);
    } else if (isStrict) {
      throw new Error(`Strict Mode: Filter "${filter.name}" is not defined`);
    }
  }

  return value;
}

/**
 * Evaluates an expression and applies its filters asynchronously.
 *
 * @example
 * const value = await evaluateExpressionWithFiltersAsync(ctx, 'name | fetchName');
 */
export async function evaluateExpressionWithFiltersAsync(
  ctx: Context,
  expr: string,
  options: any = {}
): Promise<any> {
  const { baseExpr, filters } = parseExpressionAndFilters(expr);
  let value = evaluateExpression(ctx, baseExpr);

  const isStrict = options && options.strict !== undefined ? options.strict : globalConfig.strict;

  if (isStrict && value === undefined) {
    const isLit = parseLiteral(baseExpr) !== undefined;
    if (!isLit && baseExpr !== '') {
      throw new Error(`Strict Mode: Variable "${baseExpr}" is undefined`);
    }
  }

  for (const filter of filters) {
    const fn =
      (options && options.filters?.[filter.name]) ||
      globalConfig.filters[filter.name] ||
      BUILT_IN_FILTERS[filter.name];
    if (fn) {
      value = await fn(value, ...filter.args);
    } else if (isStrict) {
      throw new Error(`Strict Mode: Filter "${filter.name}" is not defined`);
    }
  }

  return value;
}
