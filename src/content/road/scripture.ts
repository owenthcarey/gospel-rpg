/** Public-domain World English Bible, checked against the publisher 2026-09-09. */
export const NAIN_SOURCE = {
  title: 'Luke 7:11–17',
  translation: 'World English Bible',
  url: 'https://ebible.org/engwebp/LUK07.htm',
} as const;
export const nainVerses = {
  '7:11':
    'Soon afterwards, he went to a city called Nain. Many of his disciples, along with a great multitude, went with him.',
  '7:12':
    'Now when he came near to the gate of the city, behold, one who was dead was carried out, the only born son of his mother, and she was a widow. Many people of the city were with her.',
  '7:13': 'When the Lord saw her, he had compassion on her and said to her, “Don’t cry.”',
  '7:14':
    'He came near and touched the coffin, and the bearers stood still. He said, “Young man, I tell you, arise!”',
  '7:15': 'He who was dead sat up and began to speak. Then he gave him to his mother.',
  '7:16':
    'Fear took hold of all, and they glorified God, saying, “A great prophet has arisen among us!” and, “God has visited his people!”',
  '7:17':
    'This report went out concerning him in the whole of Judea and in all the surrounding region.',
} as const;
export type NainVerseId = keyof typeof nainVerses;
