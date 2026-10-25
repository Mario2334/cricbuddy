import { cleanHtmlText } from '../text';

describe('cleanHtmlText', () => {
  it('strips tags and decodes entities from API text', () => {
    expect(cleanHtmlText('Looking for 1 top order batter.&nbsp;<br>30 overs white ball&nbsp;')).toBe(
      'Looking for 1 top order batter.\n30 overs white ball',
    );
    expect(cleanHtmlText('Tom &amp; Jerry <b>XI</b>')).toBe('Tom & Jerry XI');
    expect(cleanHtmlText(undefined)).toBe('');
  });
});
