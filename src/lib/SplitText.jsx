const segmenter =
  typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

const graphemes = (s) => (segmenter ? Array.from(segmenter.segment(s), (x) => x.segment) : Array.from(s));
const EMOJI = /\p{Extended_Pictographic}/u;
const LETTER = /\p{L}/u;
const NBSP = String.fromCharCode(0xa0);

/**
 * Splits text into words (kept unbreakable) and characters (emoji-safe) so
 * GSAP can animate each glyph. Screen readers get the plain sentence.
 */
export default function SplitText({ text, as: Tag = 'span', className = '', accent = [], ...rest }) {
  // An emoji never wraps onto a line of its own: glue it to the word before.
  const words = text.split(' ').reduce((acc, w) => {
    if (acc.length && EMOJI.test(w) && !LETTER.test(w)) acc[acc.length - 1] += NBSP + w;
    else acc.push(w);
    return acc;
  }, []);

  return (
    <Tag className={className} {...rest}>
      <span className="sr-only">{text}</span>
      {words.map((word, wi) => (
        <span key={wi} aria-hidden="true">
          <span className={accent.includes(word.replace(/[^\p{L}]/gu, '')) ? 'word accent' : 'word'}>
            {graphemes(word).map((g, ci) => (
              <span key={ci} className={EMOJI.test(g) ? 'char emoji' : 'char'}>
                {g}
              </span>
            ))}
          </span>
          {wi < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  );
}
