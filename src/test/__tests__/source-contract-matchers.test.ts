describe('format-safe source contract matchers', () => {
  it('matches whole token sequences without accepting token prefixes', () => {
    expect('const ready =\n  false;').toContainSource('const ready = false;');
    expect(() => expect('falsehood').toContainSource('false')).toThrow();
    expect(() => expect('const count = 12;').toContainSource('1')).toThrow();
    expect(() => expect('value == false').toContainSource('= false')).toThrow();
  });

  it('still accepts exact prose, class, and comment fragments', () => {
    expect(
      'const label = "hold tight until the board decides";',
    ).toContainSource('hold tight until the board decides');
    expect('<View className="text-ink" />').toContainSource('text-ink');
    expect('// exact prose stays readable').toContainSource(
      'exact prose stays readable',
    );
  });

  it('never turns an empty compact regex into a universal match', () => {
    expect(() => expect('').toMatchSource(/\s+/)).toThrow();
    expect(() => expect('x').toMatchSource(/(\s+)/)).toThrow();
    expect(() => expect('x').toMatchSource(/(?:\s)/)).toThrow();
    expect(' \n').toMatchSource(/\s+/);
  });

  it('normalizes quote style without matching a string to an identifier', () => {
    expect("mode === 'twoColumn'").toContainSource('mode === "twoColumn"');
    expect(() =>
      expect('mode === twoColumn').toContainSource("mode === 'twoColumn'"),
    ).toThrow();
  });
});
