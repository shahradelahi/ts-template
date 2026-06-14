# Migrating from Handlebars.js to @se-oss/template

This guide helps you migrate your templates, helper functions, and rendering logic from `Handlebars.js` to `@se-oss/template`.

---

## Quick Reference

| Feature             | `Handlebars.js`                | `@se-oss/template`                          |
| :------------------ | :----------------------------- | :------------------------------------------ |
| **API Compile**     | `Handlebars.compile(tpl)`      | `compile(tpl)`                              |
| **Helpers**         | `Handlebars.registerHelper()`  | Pipeline Filters (`configure({ filters })`) |
| **Conditionals**    | `{{#if}}` / `{{#unless}}`      | `{{#if}}` / `{{#unless}}` (Fully Native)    |
| **Loops**           | `{{#each}}`                    | `{{#each}}` (Fully Native)                  |
| **Scope Blocks**    | `{{#with}}`                    | `{{#with}}` (Fully Native)                  |
| **Partials**        | `Handlebars.registerPartial()` | Global/Local Partials                       |
| **Async Rendering** | External plugins/wrappers      | Native `renderAsync`                        |
| **Null Coalescing** | Not supported                  | `{{user.nickname ?? "Guest"}}`              |
| **Logical OR**      | Not supported                  | `{{user.name \|\| "Guest"}}`                |

---

## 1. Compile and Render

### Handlebars.js

```js
var template = Handlebars.compile('Hello {{name}}');
var result = template({ name: 'Shahrad' });
```

### @se-oss/template

```ts
import { compile } from '@se-oss/template';

const template = compile('Hello {{name}}');
const result = template({ name: 'Shahrad' });
```

---

## 2. Global & Local Custom Helpers

Handlebars uses helpers. In `@se-oss/template`, these translate into chainable pipe filters.

### Handlebars.js

```js
Handlebars.registerHelper('shout', function (text) {
  return String(text).toUpperCase();
});
```

```html
{{shout name}}
```

### @se-oss/template

You can define filters globally or locally.

```ts
import { configure } from '@se-oss/template';

configure({
  filters: {
    shout: (val) => String(val).toUpperCase(),
  },
});
```

```html
{{name | shout}}
```

---

## 3. Conditionals, Loops, and Context Blocks

Great news: the syntax for standard block helpers (`#if`, `#unless`, `#each`, and `#with`) is fully compatible out of the box.

### Handlebars.js

```html
{{#if active}} {{#each items}}
<li>{{this}} ({{@index}})</li>
{{/each}} {{/if}}
```

### @se-oss/template

No syntax modifications are needed!

```html
{{#if active}} {{#each items}}
<li>{{this}} ({{@index}})</li>
{{/each}} {{/if}}
```

---

## 4. Partials

Both systems support dynamic partials.

### Handlebars.js

```js
Handlebars.registerPartial('header', '<h1>{{title}}</h1>');
```

```html
{{> header}}
```

### @se-oss/template

```ts
import { configure } from '@se-oss/template';

configure({
  partials: {
    header: '<h1>{{title}}</h1>',
  },
});
```

```html
{{> header}}
```

---

## 5. Expression Fallbacks (New Feature)

In Handlebars, providing defaults requires custom helpers or pre-processed data. With `@se-oss/template`, use native fallback operators.

```html
<!-- Nullish Coalescing (??) -->
<p>User: {{user.nickname ?? user.name ?? "Guest"}}</p>

<!-- Logical OR (||) -->
<p>Status: {{status || "Offline"}}</p>
```

---

## 6. Native Async Rendering (New Feature)

If your custom filters, database queries, or partial resolvers are asynchronous, `@se-oss/template` handles this natively.

```ts
import { renderAsync } from '@se-oss/template';

const output = await renderAsync(
  'Hello {{name | fetchAsyncName}}',
  {},
  undefined,
  {
    filters: {
      fetchAsyncName: async () => await getAsyncName(),
    },
  }
);
```
