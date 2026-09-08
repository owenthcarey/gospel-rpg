/**
 * World English Bible (protocanon), Luke 5. Public domain.
 * Verified against https://ebible.org/engwebp/LUK05.htm on 2026-09-08.
 * Exact verse text is separate from original narration and scene directions.
 */
export const SCRIPTURE_SOURCE = {
  title: 'World English Bible',
  abbreviation: 'WEB',
  url: 'https://ebible.org/engwebp/LUK05.htm',
  license: 'Public domain',
  verified: '2026-09-08',
} as const;

export const verses = {
  '5:1':
    'Now while the multitude pressed on him and heard the word of God, he was standing by the lake of Gennesaret.',
  '5:2':
    'He saw two boats standing by the lake, but the fishermen had gone out of them and were washing their nets.',
  '5:3':
    'He entered into one of the boats, which was Simon’s, and asked him to put out a little from the land. He sat down and taught the multitudes from the boat.',
  '5:4':
    'When he had finished speaking, he said to Simon, “Put out into the deep and let down your nets for a catch.”',
  '5:5':
    'Simon answered him, “Master, we worked all night and caught nothing; but at your word I will let down the net.”',
  '5:6':
    'When they had done this, they caught a great multitude of fish, and their net was breaking.',
  '5:7':
    'They beckoned to their partners in the other boat, that they should come and help them. They came and filled both boats, so that they began to sink.',
  '5:8':
    'But Simon Peter, when he saw it, fell down at Jesus’ knees, saying, “Depart from me, for I am a sinful man, Lord.”',
  '5:9':
    'For he was amazed, and all who were with him, at the catch of fish which they had caught;',
  '5:10':
    'and so also were James and John, sons of Zebedee, who were partners with Simon. Jesus said to Simon, “Don’t be afraid. From now on you will be catching people alive.”',
  '5:11': 'When they had brought their boats to land, they left everything, and followed him.',
} as const;
export type VerseId = keyof typeof verses;

export interface Caption {
  speaker: string;
  text: string;
  provenance: 'Original narration' | 'Scripture · WEB';
  reference?: string;
}
export function scripture(...ids: VerseId[]): Caption {
  return {
    speaker: 'The Gospel according to Luke',
    text: ids.map((id) => verses[id]).join(' '),
    provenance: 'Scripture · WEB',
    reference: 'Luke ' + (ids.length === 1 ? ids[0] : ids[0] + '–' + ids.at(-1)!.split(':')[1]),
  };
}
export function narration(text: string): Caption {
  return { speaker: 'A view across the water', text, provenance: 'Original narration' };
}
