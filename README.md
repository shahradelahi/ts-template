<h1 align="center">
  <sup>@se-oss/template</sup>
  <br>
  <a href="https://github.com/shahradelahi/ts-template/actions/workflows/ci.yml"><img src="https://github.com/shahradelahi/ts-template/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@se-oss/template"><img src="https://img.shields.io/npm/v/@se-oss/template.svg" alt="NPM Version"></a>
  <a href="/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat" alt="MIT License"></a>
  <a href="https://bundlephobia.com/package/@se-oss/template"><img src="https://img.shields.io/bundlephobia/minzip/@se-oss/template" alt="npm bundle size"></a>
  <a href="https://packagephobia.com/result?p=@se-oss/template"><img src="https://packagephobia.com/badge?p=@se-oss/template" alt="Install Size"></a>
</h1>

_@se-oss/template_ is a high-performance, safe, and highly extensible templating engine supporting Mustache syntax, pipelines, and native asynchronous execution.

## Benefits

- **Performance First:** Automated compiled function caching using a dynamic LRU cache.
- **Async Architecture:** Native support for asynchronous filters, block iterations, and partial resolution.
- **Filter Pipelines:** Chainable built-in and custom filters with parameter support.
- **Fail-Safe Operators:** Integrated nullish coalescing (`??`) and logical OR (`||`) operators.
- **Whitespace Control:** Automatic standalone tag detection and whitespace slurping.
- **Type-Level Magic:** Zero-config TypeScript schema inference directly from template string literals.
- **World-Class Errors:** Informative compiler errors coupled with syntax-highlighted code frames.
- **Secure by Default:** Active protection preventing prototype pollution and unsafe property access.

---

- [Benefits](#benefits)
- [Installation](#-installation)
- [Usage](#-usage)
- [Migration Guidelines](#-migration-guidelines)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#license)

## 📦 Installation

```bash
pnpm add @se-oss/template
```

<details>
<summary>Install using your favorite package manager</summary>

**npm**

```bash
npm install @se-oss/template
```

**yarn**

```bash
yarn add @se-oss/template
```

</details>

## 📖 Usage

### Basic Usage

```ts
import { render } from '@se-oss/template';

const result = render('Hello {{name}}!', { name: 'Shahrad' });
// Output: Hello Shahrad!
```

### HTML Escaping & Raw Outputs

By default, HTML characters are escaped. Use triple curlies or the ampersand operator to output raw HTML.

```ts
// Escaped (Default)
render('Hello {{name}}', { name: '<b>Shahrad</b>' });
// Output: Hello &lt;b&gt;Shahrad&lt;&#x2F;b&gt;

// Raw (Triple Curlies)
render('Hello {{{name}}}', { name: '<b>Shahrad</b>' });
// Output: Hello <b>Shahrad</b>

// Raw (Ampersand)
render('Hello {{&name}}', { name: '<b>Shahrad</b>' });
// Output: Hello <b>Shahrad</b>
```

### Null Coalescing & Logical Fallbacks

Safely resolve undefined or empty values inside expressions.

```ts
// Nullish Coalescing (??)
render('Hello {{user.nickname ?? user.name ?? "Guest"}}', {
  user: { nickname: null, name: 'Shahrad' },
});
// Output: Hello Shahrad

// Logical OR (||)
render('Hello {{user.name || "Guest"}}', { user: { name: '' } });
// Output: Hello Guest
```

### Conditionals

Handle logical flows with standard conditional blocks.

```ts
const tpl = '{{#if active}}Active{{else}}Inactive{{/if}}';

render(tpl, { active: true }); // Output: Active
render(tpl, { active: false }); // Output: Inactive
```

```ts
// Inverse conditionals using "unless"
render('{{#unless active}}Inactive{{/unless}}', { active: false });
// Output: Inactive
```

### Loops & Iteration

Iterate arrays and objects while exposing index metadata.

```ts
// Array Iteration
const tpl =
  '{{#each users}}{{this}} (index: {{@index}}, first: {{@first}}, last: {{@last}}){{/each}}';
render(tpl, { users: ['A', 'B'] });
// Output: A (index: 0, first: true, last: false)B (index: 1, first: false, last: true)

// Object Key-Value Iteration
render('{{#each user}}{{@key}}: {{.}}, {{/each}}', {
  user: { name: 'Shahrad', role: 'admin' },
});
// Output: name: Shahrad, role: admin,
```

### Mustache-Style Sections

Seamless generic sections supporting scope-shifting, looping, and inverted fallbacks.

```ts
// Scope shifting and nested lookup
const tpl = '{{#user}}{{name}} is {{role}}{{/user}}';
render(tpl, { user: { name: 'Shahrad', role: 'admin' } });
// Output: Shahrad is admin

// Inverted section (executes if array/value is empty or falsy)
render('{{^items}}Empty{{/items}}', { items: [] });
// Output: Empty
```

### Built-in & Custom Filters

Chain multiple filters using the pipe syntax.

```ts
// Built-in pipeline with arguments
render('{{name | trim | capitalize | default("Guest")}}', {
  name: '  shahrad  ',
});
// Output: Shahrad

// Custom local filters
render('{{name | reverse}}', { name: 'shahrad' }, undefined, {
  filters: {
    reverse: (val) => String(val).split('').reverse().join(''),
  },
});
// Output: darhahs
```

### Async Resolution

Perfect for rendering templates depending on async API calls or database lookups.

```ts
import { renderAsync } from '@se-oss/template';

const asyncFilter = async (val) => {
  return new Promise((resolve) =>
    setTimeout(() => resolve(String(val).toUpperCase()), 10)
  );
};

await renderAsync(
  'Hello {{name | toUpper}}!',
  { name: 'shahrad' },
  undefined,
  {
    filters: { toUpper: asyncFilter },
  }
);
// Output: Hello SHAHRAD!
```

### Partials

Modularize your templates. Partials compile recursively and resolve dynamically.

```ts
const partials = {
  userCard: 'Name: {{name}} (Role: {{> roleTag}}) | ',
  roleTag: '<u>{{role}}</u>',
};

render(
  '{{#each users}}{{> userCard}}{{/each}}',
  {
    users: [
      { name: 'Shahrad', role: 'Admin' },
      { name: 'Alice', role: 'User' },
    ],
  },
  partials
);
// Output: Name: Shahrad (Role: <u>Admin</u>) | Name: Alice (Role: <u>User</u>) |
```

#### Async Partial Resolvers

Dynamically fetch partials as needed during asynchronous renders.

```ts
await renderAsync('Welcome, {{> header}}!', { name: 'Shahrad' }, undefined, {
  resolvePartial: async (name) => {
    return name === 'header' ? '<b>{{name}}</b>' : '';
  },
});
// Output: Welcome, <b>Shahrad</b>!
```

### Global Configuration

Register global options, filters, partials, or strict-mode checks.

```ts
import { configure } from '@se-oss/template';

configure({
  strict: true, // Throw error on undefined variables
  cacheSize: 1000, // Dynamic LRU cache limit
  filters: {
    globalUpper: (val) => String(val).toUpperCase(),
  },
  partials: {
    baseLayout: 'Layout: {{> content}}',
  },
});
```

### TypeScript Typings

Automatic compile-time schema inference. Your IDE will know the exact fields your template expects.

```ts
import { compile } from '@se-oss/template';

const myTemplate = compile('Hello {{user.name}}, you are {{age}}');

// TypeScript errors if properties are missing or of incorrect types
myTemplate({
  user: { name: 'Shahrad' },
  age: 25,
});
```

### Error Reporting

Get immediate, pinpoint accuracy on compilation and parsing errors.

```ts
try {
  render('Hello {{#if active}}World{{/each}}', { active: true });
} catch (err) {
  console.log(err.message);
}
/*
Error: Mismatched block end: expected "if" but found "each"
  at template:1:21

> 1 | {{#if active}}Hello{{/each}}
    |                    ^
*/
```

## 🚀 Migration Guidelines

Migrating from another template engine? We have detailed step-by-step migration guides to help you transition smoothly:

- [Migrating from mustache.js](migration/mustache.md)
- [Migrating from Handlebars.js](migration/handlebars.md)

## 📚 Documentation

For all configuration options, please see [the API docs](https://www.jsdocs.io/package/@se-oss/template).

## 🤝 Contributing

Want to contribute? Awesome! To show your support is to star the project, or to raise issues on [GitHub](https://github.com/shahradelahi/ts-template).

Thanks again for your support, it is much appreciated! 🙏

## License

[MIT](/LICENSE) © [Shahrad Elahi](https://github.com/shahradelahi) and [contributors](https://github.com/shahradelahi/ts-template/graphs/contributors).
