/** Public-domain World English Bible. Checked against the publisher, 2026-09-09. */
export const ROOF_SOURCE = {
  title: 'Mark 2:1–12',
  translation: 'World English Bible',
  url: 'https://ebible.org/engwebp/MRK02.htm',
  parallel: 'https://ebible.org/engwebp/LUK05.htm',
} as const;
export const roofVerses = {
  '2:1': 'When he entered again into Capernaum after some days, it was heard that he was at home.',
  '2:2':
    'Immediately many were gathered together, so that there was no more room, not even around the door; and he spoke the word to them.',
  '2:3': 'Four people came, carrying a paralytic to him.',
  '2:4':
    'When they could not come near to him for the crowd, they removed the roof where he was. When they had broken it up, they let down the mat that the paralytic was lying on.',
  '2:5': 'Jesus, seeing their faith, said to the paralytic, “Son, your sins are forgiven you.”',
  '2:6': 'But there were some of the scribes sitting there and reasoning in their hearts,',
  '2:7': '“Why does this man speak blasphemies like that? Who can forgive sins but God alone?”',
  '2:8':
    'Immediately Jesus, perceiving in his spirit that they so reasoned within themselves, said to them, “Why do you reason these things in your hearts?',
  '2:9':
    'Which is easier, to tell the paralytic, ‘Your sins are forgiven;’ or to say, ‘Arise, and take up your bed, and walk’?',
  '2:10':
    'But that you may know that the Son of Man has authority on earth to forgive sins”—he said to the paralytic—',
  '2:11': '“I tell you, arise, take up your mat, and go to your house.”',
  '2:12':
    'He arose, and immediately took up the mat and went out in front of them all, so that they were all amazed and glorified God, saying, “We never saw anything like this!”',
} as const;
export type RoofVerseId = keyof typeof roofVerses;
