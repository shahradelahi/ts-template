import { SimpleLRUCache } from './cache';
import {
  compile,
  compileAsync,
  CompiledTemplate,
  CompiledTemplateAsync,
  CompilerOptions,
} from './compiler';
import { generateCodeFrame, TemplateError } from './errors';
import { InferSchema, RenderOptions } from './typings';
import { configure, Context, globalConfig } from './utils';

export {
  compile,
  compileAsync,
  Context,
  configure,
  globalConfig,
  SimpleLRUCache,
  TemplateError,
  generateCodeFrame,
};
export { tokenize } from './tokenizer';
export { parse } from './parser';
export { escapeHtml, BUILT_IN_FILTERS } from './utils';
export type {
  CompilerOptions,
  CompiledTemplate,
  CompiledTemplateAsync,
  RenderOptions,
  InferSchema,
};

/**
 * Renders a template synchronously with the provided data view and optional partials.
 *
 * @example
 * const output = render('Hello {{name}}!', { name: 'World' });
 */
export function render<TView = any, const TTemplate extends string = string>(
  template: TTemplate,
  view: TView extends Record<string, any> ? TView : InferSchema<TTemplate>,
  partials?: Record<string, any> | ((name: string) => any),
  options?: CompilerOptions
): string {
  const compiled = compile(template, options);
  return compiled(view, partials, options);
}

/**
 * Renders a template asynchronously. Supports async filters and async partial resolution.
 *
 * @example
 * const output = await renderAsync('Hello {{name | fetchName}}!', { name: 'user-1' });
 */
export async function renderAsync<TView = any, const TTemplate extends string = string>(
  template: TTemplate,
  view: TView extends Record<string, any> ? TView : InferSchema<TTemplate>,
  partials?: Record<string, any> | ((name: string) => any) | ((name: string) => Promise<any>),
  options?: CompilerOptions
): Promise<string> {
  const compiled = compileAsync(template, options);
  return await compiled(view, partials, options);
}
