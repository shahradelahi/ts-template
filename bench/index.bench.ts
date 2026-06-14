import { compile, render } from '@se-oss/template';
import Handlebars from 'handlebars';
import Mustache from 'mustache';
import { bench, describe } from 'vitest';

describe('Performance Benchmarks - Pre-compiled', () => {
  const template = 'Hello {{user.name}}! You have {{user.notifications.length}} unread messages.';
  const data = {
    user: {
      name: 'Shahrad',
      notifications: ['msg1', 'msg2', 'msg3'],
    },
  };

  // Baseline JS Template Literal
  const nativeLiteral = (d: typeof data) =>
    `Hello ${d.user.name}! You have ${d.user.notifications.length} unread messages.`;

  // Pre-compiled templates
  const compiledSess = compile(template);
  const compiledHandlebars = Handlebars.compile(template);
  Mustache.parse(template); // Warm up Mustache's cache

  bench('Native JS Template Literal (Baseline)', () => {
    nativeLiteral(data);
  });

  bench('@se-oss/template (AOT Compiled)', () => {
    compiledSess(data);
  });

  bench('Handlebars.js (AOT Compiled)', () => {
    compiledHandlebars(data);
  });

  bench('Mustache.js (Cached Token Tree)', () => {
    Mustache.render(template, data);
  });
});

describe('Performance Benchmarks - On-the-fly Compilation & Rendering', () => {
  const template = 'Hello {{user.name}}! You have {{user.notifications.length}} unread messages.';
  const data = {
    user: {
      name: 'Shahrad',
      notifications: ['msg1', 'msg2', 'msg3'],
    },
  };

  bench('@se-oss/template (render - cache hit)', () => {
    render(template, data);
  });

  bench('Handlebars.js (compile + execute)', () => {
    Handlebars.compile(template)(data);
  });

  bench('Mustache.js (render on-the-fly)', () => {
    Mustache.render(template, data);
  });
});
