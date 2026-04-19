import { bindTemplate, extractVariables } from './template.util';

describe('template.util', () => {
  describe('bindTemplate', () => {
    it('binds simple placeholders', () => {
      expect(bindTemplate('Hi {{name}}, total {{total}}', { name: 'An', total: 200 })).toBe(
        'Hi An, total 200',
      );
    });

    it('tolerates whitespace inside braces', () => {
      expect(bindTemplate('Hi {{ name  }}', { name: 'An' })).toBe('Hi An');
    });

    it('throws on missing variable', () => {
      expect(() => bindTemplate('Hi {{name}}', {})).toThrow(/Missing template variables: name/);
    });

    it('throws on null / empty string', () => {
      expect(() => bindTemplate('Hi {{name}}', { name: null })).toThrow(/name/);
      expect(() => bindTemplate('Hi {{name}}', { name: '' })).toThrow(/name/);
    });

    it('formats Date as ISO', () => {
      const d = new Date('2026-04-18T03:00:00Z');
      expect(bindTemplate('at {{when}}', { when: d })).toBe('at 2026-04-18T03:00:00.000Z');
    });

    it('dedupes missing vars in error message', () => {
      expect(() => bindTemplate('{{a}} {{a}} {{b}}', {})).toThrow(/a, b/);
    });
  });

  describe('extractVariables', () => {
    it('returns unique names', () => {
      expect(extractVariables('Hi {{name}}, hi {{name}} again and {{ tier }}')).toEqual([
        'name',
        'tier',
      ]);
    });

    it('returns empty for no placeholders', () => {
      expect(extractVariables('Plain body')).toEqual([]);
    });
  });
});
