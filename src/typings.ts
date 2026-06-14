import { CompilerOptions } from './compiler';

type Trim<T extends string> = T extends ` ${infer R}`
  ? Trim<R>
  : T extends `${infer L} `
    ? Trim<L>
    : T extends `\n${infer R}`
      ? Trim<R>
      : T extends `${infer L}\n`
        ? Trim<L>
        : T extends `\t${infer R}`
          ? Trim<R>
          : T extends `${infer L}\t`
            ? Trim<L>
            : T;

type CleanVarParts<V extends string> =
  Trim<V> extends `${infer Left}|${string}`
    ? CleanVarParts<Left>
    : Trim<V> extends `${infer Left}??${string}`
      ? CleanVarParts<Left>
      : Trim<V> extends `${infer Left}||${string}`
        ? CleanVarParts<Left>
        : Trim<V> extends `if ${infer Right}`
          ? CleanVarParts<Right>
          : Trim<V> extends `each ${infer Right}`
            ? CleanVarParts<Right>
            : Trim<V> extends `unless ${infer Right}`
              ? CleanVarParts<Right>
              : Trim<V> extends `with ${infer Right}`
                ? CleanVarParts<Right>
                : Trim<V>;

type CleanVar<V extends string> =
  Trim<V> extends `${'#' | '^' | '/' | '>' | '&' | '!'}${infer R}`
    ? CleanVarParts<Trim<R>> extends `@${string}`
      ? never
      : CleanVarParts<Trim<R>>
    : CleanVarParts<Trim<V>> extends `@${string}`
      ? never
      : CleanVarParts<Trim<V>>;

type ExtractVariables<T extends string> = T extends `${string}{{${infer Var}}}${infer Rest}`
  ? CleanVar<Var> | ExtractVariables<Rest>
  : never;

type PathToObject<Path extends string, Val = any> = Path extends `${infer Head}.${infer Tail}`
  ? { [K in Head]: PathToObject<Tail, Val> }
  : { [K in Path]: Val };

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

export type InferSchema<T extends string> =
  UnionToIntersection<
    ExtractVariables<T> extends infer Var
      ? Var extends string
        ? Var extends ''
          ? never
          : PathToObject<Var, any>
        : never
      : never
  > extends infer Merged
    ? { [K in keyof Merged]: Merged[K] }
    : Record<string, any>;

export interface RenderOptions extends CompilerOptions {
  partials?: Record<string, any> | ((name: string) => any);
}
