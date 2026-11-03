import { describe, expect, it } from 'vitest';
import { NAME_EXAMPLES, SOURCE_EXAMPLES, nameExample, pickExample, sourceExample } from '../../shared/domain/examples';

describe('the editor’s examples (D81)', () => {
  it('are the owner’s lists, each word capitalised', () => {
    expect(NAME_EXAMPLES).toHaveLength(12);
    expect(SOURCE_EXAMPLES).toEqual(['Cookies', 'Tenco', 'Wizard Trees', '710 Nomads', 'Z Money']);
    for (const name of [...NAME_EXAMPLES, ...SOURCE_EXAMPLES]) {
      for (const word of name.split(' ')) expect(word[0], name).toBe(word[0]!.toUpperCase());
      expect(new Set(NAME_EXAMPLES).size).toBe(NAME_EXAMPLES.length);
    }
    expect(NAME_EXAMPLES).toContain('OG Kush');
    expect(NAME_EXAMPLES).toContain('RS11');
  });

  it('picks every one, never past the end', () => {
    const seen = new Set<string>();
    for (let i = 0; i < NAME_EXAMPLES.length; i++) seen.add(pickExample(NAME_EXAMPLES, () => i / NAME_EXAMPLES.length));
    expect(seen.size).toBe(NAME_EXAMPLES.length);
    expect(pickExample(SOURCE_EXAMPLES, () => 0.999999)).toBe('Z Money');
    expect(pickExample(SOURCE_EXAMPLES, () => 1)).toBe('Z Money');
  });

  it('reads as the boxes show it', () => {
    expect(nameExample(() => 0)).toBe('e.g. Lemon Cherry Gelato');
    expect(sourceExample(() => 0)).toBe('The brand or grower, e.g. Cookies');
  });
});
