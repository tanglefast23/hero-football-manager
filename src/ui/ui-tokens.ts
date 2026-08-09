/** The four semantic UI sizes from docs/08-ui-ux.md. */
export const TYPE_SIZE = Object.freeze({
  caption: 'text-[13px]',
  body: 'text-[15px]',
  heading: 'text-[18px]',
  display: 'text-[24px]',
});

/**
 * Named art exceptions. These are wordmark/glyph geometry, not a fifth content
 * level. Additions need an art-bible reason and a source test.
 */
export const TYPE_ART_EXCEPTION = Object.freeze({
  titleWordmarkCompact: 'text-[43px] leading-[44px]',
  titleWordmarkWide: 'text-[68px] leading-[68px]',
  titleStarWide: 'text-[30px]',
  titleActionArrow: 'text-[36px]',
});
