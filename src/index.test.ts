import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  compile,
  compileAsync,
  configure,
  parse,
  render,
  renderAsync,
  SimpleLRUCache,
  TemplateError,
} from './index';

describe('@se-oss/template', () => {
  describe('Basic Interpolation', () => {
    it('should interpolate flat objects', () => {
      const result = render('Hello {{name}}!', { name: 'Shahrad' });
      expect(result).toBe('Hello Shahrad!');
    });

    it('should escape HTML by default', () => {
      const result = render('Hello {{name}}!', { name: '<script>alert(1)</script>' });
      expect(result).toBe('Hello &lt;script&gt;alert(1)&lt;&#x2F;script&gt;!');
    });

    it('should output raw HTML using triple curlies {{{ ... }}}', () => {
      const result = render('Hello {{{name}}}!', { name: '<b>Shahrad</b>' });
      expect(result).toBe('Hello <b>Shahrad</b>!');
    });

    it('should output raw HTML using ampersand {{& ... }}', () => {
      const result = render('Hello {{&name}}!', { name: '<b>Shahrad</b>' });
      expect(result).toBe('Hello <b>Shahrad</b>!');
    });

    it('should support safe navigation dot notation paths', () => {
      const result = render('Hello {{user.profile.name}}!', {
        user: { profile: { name: 'Shahrad' } },
      });
      expect(result).toBe('Hello Shahrad!');
    });

    it('should resolve to empty string for missing paths safely', () => {
      const result = render('Hello {{user.profile.name}}!', { user: {} });
      expect(result).toBe('Hello !');
    });

    it('should support optional chaining syntax in expression', () => {
      const result = render('Hello {{user?.profile?.name}}!', { user: {} });
      expect(result).toBe('Hello !');
    });

    it('should execute functions and bind them to their parent object', () => {
      const view = {
        name: 'Shahrad',
        getName() {
          return this.name;
        },
      };
      const result = render('Hello {{getName}}!', view);
      expect(result).toBe('Hello Shahrad!');
    });
  });

  describe('Comments', () => {
    it('should ignore comment tags completely', () => {
      const result = render('Hello {{! this is a comment }}World!', {});
      expect(result).toBe('Hello World!');
    });
  });

  describe('Null Coalescing and Logical OR Fallbacks', () => {
    it('should support nullish coalescing operator ??', () => {
      const result1 = render('Hello {{user.name ?? "Guest"}}!', { user: { name: null } });
      const result2 = render('Hello {{user.name ?? "Guest"}}!', { user: { name: 'Shahrad' } });
      expect(result1).toBe('Hello Guest!');
      expect(result2).toBe('Hello Shahrad!');
    });

    it('should support logical OR operator ||', () => {
      const result1 = render('Hello {{user.name || "Guest"}}!', { user: { name: '' } });
      const result2 = render('Hello {{user.name || "Guest"}}!', { user: { name: 'Shahrad' } });
      expect(result1).toBe('Hello Guest!');
      expect(result2).toBe('Hello Shahrad!');
    });

    it('should support multiple fallbacks', () => {
      const result = render('Hello {{user.nickname ?? user.name ?? "Guest"}}!', {
        user: { nickname: null, name: 'Shahrad' },
      });
      expect(result).toBe('Hello Shahrad!');
    });
  });

  describe('Conditionals: If / Unless', () => {
    it('should support standard {{#if}} blocks', () => {
      const template = '{{#if active}}Active{{/if}}';
      expect(render(template, { active: true })).toBe('Active');
      expect(render(template, { active: false })).toBe('');
    });

    it('should support {{#if}} with {{else}} branches', () => {
      const template = '{{#if active}}Active{{else}}Inactive{{/if}}';
      expect(render(template, { active: true })).toBe('Active');
      expect(render(template, { active: false })).toBe('Inactive');
    });

    it('should support {{#unless}} blocks', () => {
      const template = '{{#unless active}}Inactive{{else}}Active{{/unless}}';
      expect(render(template, { active: false })).toBe('Inactive');
      expect(render(template, { active: true })).toBe('Active');
    });
  });

  describe('Loops and Iterations: Each', () => {
    it('should iterate over arrays and expose item properties', () => {
      const template = '{{#each users}}{{name}} {{/each}}';
      const data = { users: [{ name: 'A' }, { name: 'B' }] };
      expect(render(template, data)).toBe('A B ');
    });

    it('should expose loop metadata: @index, @first, @last', () => {
      const template =
        '{{#each items}}{{this}} (index: {{@index}}, first: {{@first}}, last: {{@last}}){{/each}}';
      const data = { items: ['A', 'B'] };
      expect(render(template, data)).toBe(
        'A (index: 0, first: true, last: false)B (index: 1, first: false, last: true)'
      );
    });

    it('should iterate over object keys and values with @key', () => {
      const template = '{{#each user}}{{@key}}: {{.}}, {{/each}}';
      const data = { user: { name: 'Shahrad', role: 'admin' } };
      expect(render(template, data)).toBe('name: Shahrad, role: admin, ');
    });
  });

  describe('Mustache-Style Sections', () => {
    it('should handle standard generic section loops', () => {
      const template = '{{#users}}{{name}} {{/users}}';
      const data = { users: [{ name: 'A' }, { name: 'B' }] };
      expect(render(template, data)).toBe('A B ');
    });

    it('should handle generic section scope shifting', () => {
      const template = '{{#user}}{{name}} is {{role}}{{/user}}';
      const data = { user: { name: 'Shahrad', role: 'admin' } };
      expect(render(template, data)).toBe('Shahrad is admin');
    });

    it('should handle inverted mustache-style sections', () => {
      const template = '{{^users}}No users available{{/users}}';
      expect(render(template, { users: [] })).toBe('No users available');
      expect(render(template, { users: [{ name: 'A' }] })).toBe('');
    });
  });

  describe('Whitespace Slurping (Standalone Tags)', () => {
    it('should slurp newlines and whitespace around standalone block tags', () => {
      const template = `
<ul>
  {{#each items}}
  <li>{{this}}</li>
  {{/each}}
</ul>
`.trim();
      const expected = `
<ul>
  <li>A</li>
  <li>B</li>
</ul>
`.trim();
      const data = { items: ['A', 'B'] };
      expect(render(template, data)).toBe(expected);
    });
  });

  describe('Filters / Pipes', () => {
    it('should apply built-in filters', () => {
      const tpl1 = '{{name | capitalize}}';
      const tpl2 = '{{name | uppercase}}';
      const tpl3 = '{{name | lowercase}}';
      const tpl4 = '{{name | trim}}';

      expect(render(tpl1, { name: 'shahrad' })).toBe('Shahrad');
      expect(render(tpl2, { name: 'shahrad' })).toBe('SHAHRAD');
      expect(render(tpl3, { name: 'SHAHRAD' })).toBe('shahrad');
      expect(render(tpl4, { name: '  shahrad  ' })).toBe('shahrad');
    });

    it('should pipeline multiple filters', () => {
      const template = '{{name | trim | capitalize}}';
      expect(render(template, { name: '  shahrad  ' })).toBe('Shahrad');
    });

    it('should support filters with arguments', () => {
      const template = '{{name | default("Anonymous")}}';
      expect(render(template, { name: null })).toBe('Anonymous');
      expect(render(template, { name: 'Shahrad' })).toBe('Shahrad');
    });

    it('should support custom filters', () => {
      const template = '{{name | customReverse}}';
      const options = {
        filters: {
          customReverse: (val: any) => String(val).split('').reverse().join(''),
        },
      };
      expect(render(template, { name: 'shahrad' }, undefined, options)).toBe('darhahs');
    });
  });

  describe('Partials', () => {
    it('should render registered partials', () => {
      const template = 'Welcome, {{> userCard}}!';
      const partials = {
        userCard: '<b>{{name}}</b>',
      };
      const result = render(template, { name: 'Shahrad' }, partials);
      expect(result).toBe('Welcome, <b>Shahrad</b>!');
    });

    it('should compile and render partials recursively', () => {
      const template = '{{#each users}}{{> userCard}}{{/each}}';
      const partials = {
        userCard: 'Name: {{name}} (Role: {{> roleTag}}) | ',
        roleTag: '<u>{{role}}</u>',
      };
      const data = {
        users: [
          { name: 'Shahrad', role: 'Admin' },
          { name: 'Alice', role: 'User' },
        ],
      };
      const result = render(template, data, partials);
      expect(result).toBe(
        'Name: Shahrad (Role: <u>Admin</u>) | Name: Alice (Role: <u>User</u>) | '
      );
    });
  });

  describe('Security and Sandbox Protection', () => {
    it('should prevent prototype pollution lookups', () => {
      const template = '{{__proto__.polluted}}';
      const data = {};
      // Set value on Object prototype to simulate pollution
      (Object.prototype as any).polluted = 'dangerous';

      try {
        expect(render(template, data)).toBe('');
      } finally {
        delete (Object.prototype as any).polluted;
      }
    });

    it('should prevent constructor/prototype access', () => {
      const tpl1 = '{{constructor}}';
      const tpl2 = '{{prototype}}';
      expect(render(tpl1, {})).toBe('');
      expect(render(tpl2, {})).toBe('');
    });
  });

  describe('Strict Mode Option', () => {
    it('should throw an error for undefined variables when strict is true', () => {
      const template = 'Hello {{missingVar}}!';
      expect(() => render(template, {}, undefined, { strict: true })).toThrowError(
        'Strict Mode: Variable "missingVar" is undefined'
      );
    });

    it('should not throw an error for undefined variables when strict is false', () => {
      const template = 'Hello {{missingVar}}!';
      expect(render(template, {}, undefined, { strict: false })).toBe('Hello !');
    });

    it('should throw an error for undefined filters when strict is true', () => {
      const template = 'Hello {{name | missingFilter}}!';
      expect(() => render(template, { name: 'Shahrad' }, undefined, { strict: true })).toThrowError(
        'Strict Mode: Filter "missingFilter" is not defined'
      );
    });
  });

  describe('Type-Level Magic (TS Typings)', () => {
    it('should infer properties correctly from basic template string', () => {
      const myTemplate = compile('Hello {{user.name}}, you are {{age}}');

      // We use expectTypeOf from vitest to do type checks at compile time
      expectTypeOf(myTemplate).toBeCallableWith({
        user: { name: 'Shahrad' },
        age: 25,
      });
    });
  });

  describe('World-Class Error Reporting (Code Frames)', () => {
    it('should throw TemplateError with code frames for unclosed tag', () => {
      const template = 'Hello {{name';
      try {
        render(template, { name: 'Shahrad' });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err).toBeInstanceOf(TemplateError);
        expect(err.message).toContain('at template:1:13');
        expect(err.message).toContain('> 1 | Hello {{name');
        expect(err.message).toContain('    |             ^');
      }
    });

    it('should throw TemplateError for mismatched block end', () => {
      const template = '{{#if active}}Hello{{/each}}';
      try {
        render(template, { active: true });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err).toBeInstanceOf(TemplateError);
        expect(err.message).toContain('Mismatched block end: expected "if" but found "each"');
        expect(err.message).toContain('> 1 | {{#if active}}Hello{{/each}}');
        expect(err.message).toContain('    |                    ^');
      }
    });

    it('should throw TemplateError for orphaned else tag', () => {
      const template = 'Hello\n{{else}}';
      try {
        render(template, {});
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err).toBeInstanceOf(TemplateError);
        expect(err.message).toContain('Orphaned else tag');
        expect(err.message).toContain('at template:2:1');
        expect(err.message).toContain('> 2 | {{else}}');
        expect(err.message).toContain('    | ^');
      }
    });

    it('should throw TemplateError for unopened section', () => {
      const template = 'Hello\n{{/if}}';
      try {
        render(template, {});
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err).toBeInstanceOf(TemplateError);
        expect(err.message).toContain('Unopened section "if"');
        expect(err.message).toContain('at template:2:1');
        expect(err.message).toContain('> 2 | {{/if}}');
        expect(err.message).toContain('    | ^');
      }
    });
  });

  describe('Helpers & Global Configuration', () => {
    it('should allow registering global filters', () => {
      configure({
        filters: {
          globalUpper: (val) => String(val).toUpperCase(),
        },
      });

      const template = '{{name | globalUpper}}';
      expect(render(template, { name: 'shahrad' })).toBe('SHAHRAD');
    });

    it('should respect local filter overriding global filter', () => {
      configure({
        filters: {
          testFilter: () => 'global',
        },
      });

      const template = '{{name | testFilter}}';
      expect(render(template, { name: 'shahrad' })).toBe('global');
      expect(
        render(template, { name: 'shahrad' }, undefined, {
          filters: {
            testFilter: () => 'local',
          },
        })
      ).toBe('local');
    });

    it('should support global partial configuration', () => {
      configure({
        partials: {
          globCard: 'Global Card {{name}}',
        },
      });

      const template = '{{> globCard}}';
      expect(render(template, { name: 'Shahrad' })).toBe('Global Card Shahrad');
    });
  });

  describe('Asynchronous Resolution and Async Rendering', () => {
    it('should render async interpolation and async filters', async () => {
      const asyncFilter = async (val: any) => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(String(val).toUpperCase()), 10);
        });
      };

      const template = 'Hello {{name | myAsyncUpper}}!';
      const result = await renderAsync(template, { name: 'shahrad' }, undefined, {
        filters: {
          myAsyncUpper: asyncFilter,
        },
      });
      expect(result).toBe('Hello SHAHRAD!');
    });

    it('should render async each block correctly', async () => {
      const template = '{{#each users}}{{this}} {{/each}}';
      const result = await renderAsync(template, { users: ['A', 'B'] });
      expect(result).toBe('A B ');
    });

    it('should compile and render async templates explicitly', async () => {
      const compiled = compileAsync('Hello {{name}}!');
      const result = await compiled({ name: 'Shahrad' });
      expect(result).toBe('Hello Shahrad!');
    });

    it('should support async resolution of partials via resolvePartial hook', async () => {
      const template = 'Welcome, {{> header}}!';
      const resolvePartialTemplate = async (name: string) => {
        return new Promise<string>((resolve) => {
          if (name === 'header') {
            resolve('<b>{{name}}</b>');
          } else {
            resolve('');
          }
        });
      };

      const res = await renderAsync(template, { name: 'Shahrad' }, undefined, {
        resolvePartial: resolvePartialTemplate,
      });
      expect(res).toBe('Welcome, <b>Shahrad</b>!');
    });
  });

  describe('SimpleLRUCache', () => {
    it('should evict the least recently used element when maxSize is exceeded', () => {
      const cache = new SimpleLRUCache<string, number>(3);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      expect(cache.size).toBe(3);

      // Access 'a' to make it recently used
      expect(cache.get('a')).toBe(1);

      // Set 'd' which should evict 'b' (since 'b' is now the oldest)
      cache.set('d', 4);

      expect(cache.size).toBe(3);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('a')).toBe(1);
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    it('should dynamically update engine caches when global cacheSize is configured', () => {
      configure({ cacheSize: 10 });
      const template1 = '1 {{v}}';
      const template2 = '2 {{v}}';
      render(template1, { v: 'A' });
      render(template2, { v: 'B' });

      configure({ cacheSize: 1 });
      render('3 {{v}}', { v: 'C' });
    });
  });

  describe('Advanced Edge Cases', () => {
    it('should respect global strict mode option in rendering', () => {
      configure({ strict: true });
      try {
        expect(() => render('Hello {{missingVar}}!', {})).toThrowError(
          'Strict Mode: Variable "missingVar" is undefined'
        );
      } finally {
        configure({ strict: false });
      }
    });

    it('should fall back to global config partials in async rendering', async () => {
      configure({
        partials: {
          globAsyncCard: 'GlobAsync {{name}}',
        },
      });

      const result = await renderAsync('Welcome {{> globAsyncCard}}!', { name: 'Shahrad' });
      expect(result).toBe('Welcome GlobAsync Shahrad!');
    });

    it('should fall back to standard Error in parse if template is not provided', () => {
      // Create tokens with mismatched blocks to force a parse error
      const tokens = [
        { type: 'BlockStart' as const, value: 'if', name: 'if', expr: 'active', start: 0, end: 14 },
        { type: 'BlockEnd' as const, value: 'each', start: 14, end: 24 },
      ];

      expect(() => parse(tokens)).toThrow(Error);
      try {
        parse(tokens);
      } catch (err: any) {
        expect(err).not.toBeInstanceOf(TemplateError);
        expect(err.message).toBe(
          'Mismatched block end: expected "if" but found "each" at position 14'
        );
      }
    });

    it('should return the exact same compiled function reference on compile cache hits', () => {
      const template = 'Hello {{name}}!';
      const fn1 = compile(template);
      const fn2 = compile(template);
      expect(fn1).toBe(fn2);
    });

    it('should return the exact same compiled async function reference on compileAsync cache hits', () => {
      const template = 'Hello {{name}}!';
      const fn1 = compileAsync(template);
      const fn2 = compileAsync(template);
      expect(fn1).toBe(fn2);
    });
  });
});
