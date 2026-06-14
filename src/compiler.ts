import { SimpleLRUCache } from './cache';
import { ASTNode, parse } from './parser';
import { tokenize } from './tokenizer';
import {
  Context,
  escapeHtml,
  evaluateExpressionWithFilters,
  evaluateExpressionWithFiltersAsync,
  globalConfig,
  registerConfigListener,
} from './utils';

export interface CompilerOptions {
  filters?: Record<string, (val: any, ...args: any[]) => any>;
  compilePartial?: (template: string, options: any) => CompiledTemplate;
  compilePartialAsync?: (template: string, options: any) => CompiledTemplateAsync;
  [key: string]: any;
}

export type CompiledTemplate = (
  data: any,
  partials?: Record<string, any> | ((name: string) => any),
  options?: CompilerOptions
) => string;

export type CompiledTemplateAsync = (
  data: any,
  partials?: Record<string, any> | ((name: string) => any) | ((name: string) => Promise<any>),
  options?: CompilerOptions
) => Promise<string>;

/**
 * Compiles an array of AST nodes into a executable JavaScript function source string.
 */
export function compileToSource(nodes: ASTNode[], isAsync = false): string {
  let code = 'let out = "";\n';

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node) {
      continue;
    }

    if (node.type === 'Text') {
      const escapedText = JSON.stringify(node.value);
      code += `out += ${escapedText};\n`;
    } else if (node.type === 'Interpolation') {
      const expr = JSON.stringify(node.expr || '');
      const awaitStr = isAsync ? 'await ' : '';
      code += `out += ${awaitStr}helpers.escapeHtml(${awaitStr}helpers.evaluateExpressionWithFilters(ctx, ${expr}, options));\n`;
    } else if (node.type === 'Raw') {
      const expr = JSON.stringify(node.expr || '');
      const awaitStr = isAsync ? 'await ' : '';
      code += `out += String(${awaitStr}helpers.evaluateExpressionWithFilters(ctx, ${expr}, options) ?? "");\n`;
    } else if (node.type === 'Partial') {
      const expr = JSON.stringify(node.expr || '');
      const awaitStr = isAsync ? 'await ' : '';
      code += `out += ${awaitStr}helpers.renderPartial(${expr}, ctx, partials, options, helpers);\n`;
    } else if (node.type === 'Block') {
      const childFnName = `children_${i}`;
      const elseFnName = `else_${i}`;

      const childrenSource =
        node.children && node.children.length > 0
          ? compileToSource(node.children, isAsync)
          : 'let out = "";\nreturn out;';
      const elseSource =
        node.elseChildren && node.elseChildren.length > 0
          ? compileToSource(node.elseChildren, isAsync)
          : 'let out = "";\nreturn out;';

      const asyncPrefix = isAsync ? 'async ' : '';
      code += `const ${childFnName} = ${asyncPrefix}(ctx) => {\n${childrenSource}\n};\n`;
      code += `const ${elseFnName} = ${asyncPrefix}(ctx) => {\n${elseSource}\n};\n`;

      const expr = JSON.stringify(node.expr || '');
      const name = JSON.stringify(node.name || '');
      const awaitStr = isAsync ? 'await ' : '';
      code += `out += ${awaitStr}helpers.renderBlock(ctx, ${expr}, ${name || 'undefined'}, ${node.inverted || false}, ${childFnName}, ${elseFnName}, options, partials, helpers);\n`;
    }
  }

  code += 'return out;\n';
  return code;
}

function isValTruthy(val: any): boolean {
  if (Array.isArray(val)) {
    return val.length > 0;
  }
  return !!val;
}

/**
 * Renders a block node (such as if, each, or unless) with the given context.
 *
 * @example
 * const result = renderBlock(ctx, 'items', 'each', false, renderChildren, renderElse, options, partials, helpers);
 */
export function renderBlock(
  ctx: Context,
  expr: string,
  name: string | undefined,
  inverted: boolean,
  renderChildren: (ctx: Context) => string,
  renderElse: (ctx: Context) => string,
  options: any,
  _partials: any,
  _helpers: any
): string {
  const val = evaluateExpressionWithFilters(ctx, expr, options);
  const isTruthy = inverted ? !isValTruthy(val) : isValTruthy(val);

  if (name === 'if') {
    return isTruthy ? renderChildren(ctx) : renderElse(ctx);
  } else if (name === 'unless') {
    const unlessTruthy = !isValTruthy(val);
    return unlessTruthy ? renderChildren(ctx) : renderElse(ctx);
  } else if (name === 'each') {
    if (Array.isArray(val) && val.length > 0) {
      let out = '';
      for (let i = 0; i < val.length; i++) {
        const itemCtx = ctx.push(val[i], {
          '@index': i,
          '@first': i === 0,
          '@last': i === val.length - 1,
        });
        out += renderChildren(itemCtx);
      }
      return out;
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      let out = '';
      const keys = Object.keys(val);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key === undefined) {
          continue;
        }
        const itemCtx = ctx.push(val[key], {
          '@key': key,
          '@index': i,
          '@first': i === 0,
          '@last': i === keys.length - 1,
        });
        out += renderChildren(itemCtx);
      }
      return out;
    } else {
      return renderElse(ctx);
    }
  } else if (name === 'with') {
    return val !== null && val !== undefined ? renderChildren(ctx.push(val)) : renderElse(ctx);
  } else {
    // Mustache generic section
    if (inverted) {
      return isTruthy ? renderChildren(ctx) : renderElse(ctx);
    }
    if (Array.isArray(val)) {
      if (val.length > 0) {
        let out = '';
        for (let i = 0; i < val.length; i++) {
          out += renderChildren(ctx.push(val[i]));
        }
        return out;
      } else {
        return renderElse(ctx);
      }
    } else if (typeof val === 'function') {
      const result = val.call(ctx.view, renderChildren(ctx));
      return result !== null && result !== undefined ? String(result) : '';
    } else if (isTruthy) {
      if (typeof val === 'object' && val !== null) {
        return renderChildren(ctx.push(val));
      } else {
        return renderChildren(ctx);
      }
    } else {
      return renderElse(ctx);
    }
  }
}

/**
 * Renders a block node asynchronously (such as if, each, or unless) with the given context.
 *
 * @example
 * const result = await renderBlockAsync(ctx, 'items', 'each', false, renderChildren, renderElse, options, partials, helpers);
 */
export async function renderBlockAsync(
  ctx: Context,
  expr: string,
  name: string | undefined,
  inverted: boolean,
  renderChildren: (ctx: Context) => Promise<string>,
  renderElse: (ctx: Context) => Promise<string>,
  options: any,
  _partials: any,
  _helpers: any
): Promise<string> {
  const val = await evaluateExpressionWithFiltersAsync(ctx, expr, options);
  const isTruthy = inverted ? !isValTruthy(val) : isValTruthy(val);

  if (name === 'if') {
    return isTruthy ? await renderChildren(ctx) : await renderElse(ctx);
  } else if (name === 'unless') {
    const unlessTruthy = !isValTruthy(val);
    return unlessTruthy ? await renderChildren(ctx) : await renderElse(ctx);
  } else if (name === 'each') {
    if (Array.isArray(val) && val.length > 0) {
      let out = '';
      for (let i = 0; i < val.length; i++) {
        const itemCtx = ctx.push(val[i], {
          '@index': i,
          '@first': i === 0,
          '@last': i === val.length - 1,
        });
        out += await renderChildren(itemCtx);
      }
      return out;
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      let out = '';
      const keys = Object.keys(val);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key === undefined) {
          continue;
        }
        const itemCtx = ctx.push(val[key], {
          '@key': key,
          '@index': i,
          '@first': i === 0,
          '@last': i === keys.length - 1,
        });
        out += await renderChildren(itemCtx);
      }
      return out;
    } else {
      return await renderElse(ctx);
    }
  } else if (name === 'with') {
    return val !== null && val !== undefined
      ? await renderChildren(ctx.push(val))
      : await renderElse(ctx);
  } else {
    // Mustache generic section
    if (inverted) {
      return isTruthy ? await renderChildren(ctx) : await renderElse(ctx);
    }
    if (Array.isArray(val)) {
      if (val.length > 0) {
        let out = '';
        for (let i = 0; i < val.length; i++) {
          out += await renderChildren(ctx.push(val[i]));
        }
        return out;
      } else {
        return await renderElse(ctx);
      }
    } else if (typeof val === 'function') {
      const result = await val.call(ctx.view, await renderChildren(ctx));
      return result !== null && result !== undefined ? String(result) : '';
    } else if (isTruthy) {
      if (typeof val === 'object' && val !== null) {
        return await renderChildren(ctx.push(val));
      } else {
        return await renderChildren(ctx);
      }
    } else {
      return await renderElse(ctx);
    }
  }
}

/**
 * Resolves and renders a partial template synchronously.
 *
 * @example
 * const output = renderPartial('userCard', ctx, partials, options, helpers);
 */
export function renderPartial(
  name: string,
  ctx: Context,
  partials: Record<string, any> | ((name: string) => any) | undefined,
  options: any,
  helpers: any
): string {
  let partialTemplate: any = undefined;
  if (options && typeof options.resolvePartial === 'function') {
    partialTemplate = options.resolvePartial(name);
  } else if (partials) {
    partialTemplate = typeof partials === 'function' ? partials(name) : partials[name];
  } else if (globalConfig.partials) {
    partialTemplate =
      typeof globalConfig.partials === 'function'
        ? globalConfig.partials(name)
        : globalConfig.partials[name];
  }

  if (partialTemplate === null || partialTemplate === undefined) {
    return '';
  }

  const compiled = options.compilePartial
    ? options.compilePartial(partialTemplate, options)
    : helpers.compile(partialTemplate, options);
  return compiled(ctx, partials, options);
}

/**
 * Resolves and renders a partial template asynchronously.
 *
 * @example
 * const output = await renderPartialAsync('userCard', ctx, partials, options, helpers);
 */
export async function renderPartialAsync(
  name: string,
  ctx: Context,
  partials:
    | Record<string, any>
    | ((name: string) => any)
    | ((name: string) => Promise<any>)
    | undefined,
  options: any,
  helpers: any
): Promise<string> {
  let partialTemplate: any = undefined;
  if (options && typeof options.resolvePartial === 'function') {
    partialTemplate = await options.resolvePartial(name);
  } else if (partials) {
    partialTemplate = typeof partials === 'function' ? await partials(name) : partials[name];
  } else if (globalConfig.partials) {
    partialTemplate =
      typeof globalConfig.partials === 'function'
        ? await globalConfig.partials(name)
        : globalConfig.partials[name];
  }

  if (partialTemplate === null || partialTemplate === undefined) {
    return '';
  }

  const compiled = options.compilePartialAsync
    ? await options.compilePartialAsync(partialTemplate, options)
    : helpers.compileAsync(partialTemplate, options);
  return await compiled(ctx, partials, options);
}

let templateCache = new SimpleLRUCache<string, CompiledTemplate>(globalConfig.cacheSize);
let templateCacheAsync = new SimpleLRUCache<string, CompiledTemplateAsync>(globalConfig.cacheSize);
let partialCache = new SimpleLRUCache<string, CompiledTemplate>(globalConfig.cacheSize);
let partialCacheAsync = new SimpleLRUCache<string, CompiledTemplateAsync>(globalConfig.cacheSize);

registerConfigListener((config) => {
  if (config.cacheSize !== templateCache.maxSize) {
    templateCache = new SimpleLRUCache(config.cacheSize);
    templateCacheAsync = new SimpleLRUCache(config.cacheSize);
    partialCache = new SimpleLRUCache(config.cacheSize);
    partialCacheAsync = new SimpleLRUCache(config.cacheSize);
  }
});

/**
 * Compiles a template string into a synchronous rendering function.
 *
 * @example
 * const render = compile('Hello {{name}}!');
 * const output = render({ name: 'World' });
 */
export function compile(template: string, options: CompilerOptions = {}): CompiledTemplate {
  const cached = templateCache.get(template);
  if (cached) {
    return cached;
  }

  const tokens = tokenize(template);
  const ast = parse(tokens, template);
  const body = compileToSource(ast);

  const compiledFn = new Function('ctx', 'helpers', 'partials', 'options', body) as any;

  const helpers = {
    escapeHtml,
    evaluateExpressionWithFilters,
    renderBlock,
    renderPartial,
    compile: (tpl: string, opts: any) => {
      let cachedPart = partialCache.get(tpl);
      if (!cachedPart) {
        cachedPart = compile(tpl, opts);
        partialCache.set(tpl, cachedPart);
      }
      return cachedPart;
    },
  };

  const compiled: CompiledTemplate = (data, partials, runOptions) => {
    const mergedOptions = { ...options, ...runOptions };
    const context = data instanceof Context ? data : new Context(data);
    return compiledFn(context, helpers, partials, mergedOptions);
  };

  templateCache.set(template, compiled);
  return compiled;
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

/**
 * Compiles a template string into an asynchronous rendering function.
 *
 * @example
 * const renderAsync = compileAsync('Hello {{name}}!');
 * const output = await renderAsync({ name: 'World' });
 */
export function compileAsync(
  template: string,
  options: CompilerOptions = {}
): CompiledTemplateAsync {
  const cached = templateCacheAsync.get(template);
  if (cached) {
    return cached;
  }

  const tokens = tokenize(template);
  const ast = parse(tokens, template);
  const body = compileToSource(ast, true);

  const compiledFn = new AsyncFunction('ctx', 'helpers', 'partials', 'options', body) as any;

  const helpers = {
    escapeHtml,
    evaluateExpressionWithFilters: evaluateExpressionWithFiltersAsync,
    renderBlock: renderBlockAsync,
    renderPartial: renderPartialAsync,
    compileAsync: (tpl: string, opts: any) => {
      let cachedPart = partialCacheAsync.get(tpl);
      if (!cachedPart) {
        cachedPart = compileAsync(tpl, opts);
        partialCacheAsync.set(tpl, cachedPart);
      }
      return cachedPart;
    },
  };

  const compiled: CompiledTemplateAsync = async (data, partials, runOptions) => {
    const mergedOptions = { ...options, ...runOptions };
    const context = data instanceof Context ? data : new Context(data);
    return await compiledFn(context, helpers, partials, mergedOptions);
  };

  templateCacheAsync.set(template, compiled);
  return compiled;
}
