# Migrating from mustache.js to @se-oss/template

This guide helps you migrate your templates and rendering logic from `mustache.js` to `@se-oss/template`.

---

## Quick Reference

| Feature           | `mustache.js`                | `@se-oss/template`                               |
| :---------------- | :--------------------------- | :----------------------------------------------- |
| **Module System** | CJS / ESM                    | ESM / CJS (High-perf)                            |
| **Async Support** | None (Sync only)             | Native `renderAsync`                             |
| **HTML Escaping** | Default (override global fn) | Default (override globally/locally)              |
| **Conditionals**  | `#section` / `^section`      | `#if` / `#unless` / Mustache compatibility       |
| **Loops**         | Array section (`#section`)   | `#each` (with metadata) / Mustache compatibility |
| **Filters**       | Not supported                | Pipe pipelines (`{{val \| capitalize}}`)         |
| **Fallbacks**     | Not supported                | Nullish coalescing (`??`), Logical OR (`\|\|`)   |
| **Caching**       | Unconfigurable cache         | Configurable `SimpleLRUCache`                    |
| **TypeScript**    | External `@types/mustache`   | Built-in zero-config typings & schema inference  |

---

## 1. Imports and Basic Rendering

### mustache.js

```js
const Mustache = require('mustache');

const output = Mustache.render('Hello {{name}}', { name: 'Shahrad' });
```

### @se-oss/template

```ts
import { render } from '@se-oss/template';

const output = render('Hello {{name}}', { name: 'Shahrad' });
```

---

## 2. Asynchronous Execution

If your data relies on async calls (e.g., databases, fetch calls) or you are using async filters, `@se-oss/template` supports this natively with `renderAsync`.

### mustache.js

Mustache does not support asynchronous operations. You have to resolve everything beforehand.

### @se-oss/template

```ts
import { renderAsync } from '@se-oss/template';

const output = await renderAsync('Hello {{name | fetchName}}', {}, undefined, {
  filters: {
    fetchName: async () => {
      return await getAsyncName();
    },
  },
});
```

---

## 3. Conditionals

`mustache.js` uses generic sections for conditionals. In `@se-oss/template`, you get dedicated `#if` and `#unless` tags alongside traditional Mustache section checks.

### mustache.js

```html
{{#isLoggedIn}} Welcome back! {{/isLoggedIn}} {{^isLoggedIn}} Please log in.
{{/isLoggedIn}}
```

### @se-oss/template

You can keep your old Mustache style, or upgrade to dedicated conditional blocks.

```html
{{#if isLoggedIn}} Welcome back! {{else}} Please log in. {{/if}}
```

---

## 4. Loops and Iterations

While `@se-oss/template` retains full compatibility with Mustache-style sections, the explicit `#each` tag gives you access to crucial loop metadata.

### mustache.js

```html
{{#users}}
<li>{{name}}</li>
{{/users}}
```

To access the array item index or check if it is the first/last item, you would have to pre-process the array in your view object.

### @se-oss/template

Upgrade to `#each` to access `@index`, `@first`, and `@last` metadata automatically.

```html
{{#each users}}
<li class="{{#if @first}}active-item{{/if}}">[{{@index}}]: {{name}}</li>
{{/each}}
```

---

## 5. Adding Fallbacks (New Feature)

In `mustache.js`, resolving missing keys to defaults requires modifying the view object. With `@se-oss/template`, you can write fallbacks directly into your templates using `??` or `||`.

```html
<!-- Nullish Coalescing fallback -->
<h3>Welcome, {{user.nickname ?? user.name ?? "Guest"}}!</h3>

<!-- Logical OR fallback -->
<p>Status: {{status || "Unknown"}}</p>
```

---

## 6. Utilizing Pipelines & Filters (New Feature)

`mustache.js` lacks filters. In `@se-oss/template`, you can use built-in or custom filters to format template expressions on the fly.

```html
<!-- Capitalize and trim automatically -->
<h1>{{user.name | trim | capitalize}}</h1>

<!-- Use filters with custom arguments -->
<p>Joined: {{joinedDate | default("Not Specified")}}</p>
```

---

## 7. Dynamic Partials

Both libraries support dynamic partial rendering. However, `@se-oss/template` lets you load partials asynchronously when rendering.

### mustache.js

```js
Mustache.render(template, view, {
  userCard: '<b>{{name}}</b>',
});
```

### @se-oss/template

```ts
// Sync rendering
render(template, view, {
  userCard: '<b>{{name}}</b>',
});

// Async resolution on the fly
await renderAsync(template, view, undefined, {
  resolvePartial: async (name) => {
    return await fetchPartialFromServer(name);
  },
});
```

---

## 8. Error Diagnostics

`mustache.js` fails with simple error messages. `@se-oss/template` gives you full code frames to pinpoint syntax problems immediately.

### mustache.js error

```
Error: Unclosed tag at 15
```

### @se-oss/template error

```
Error: Mismatched block end: expected "if" but found "each"
  at template:1:21

> 1 | {{#if active}}Hello{{/each}}
    |                    ^
```
