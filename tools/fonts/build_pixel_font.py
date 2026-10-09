"""Build "Way Pixel", the game's original proportional bitmap interface face.

Every glyph below is drawn on a pixel grid: '#' is ink, '.' is paper. A glyph's
`asc` is the number of its rows that sit above the baseline; any remaining rows
hang below it. Capitals are nine pixels tall, lowercase six, descenders three.

The em is twelve pixels (1200 units), so CSS sizes of 12, 18 and 24 px draw each
font pixel as exactly 1, 1.5 and 2 CSS pixels. The bold face is derived by
inking each pixel's right neighbour, the classic bitmap emboldening.

    uv run --with fonttools --with brotli python3 tools/fonts/build_pixel_font.py
"""

from __future__ import annotations

from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

UNITS = 100  # one font pixel
EM = 12 * UNITS
ASCENT = 10 * UNITS
DESCENT = 3 * UNITS
OUT = Path(__file__).resolve().parents[2] / 'src' / 'ui' / 'fonts'

# name: (codepoints, asc, rows)
G: dict[str, tuple[str, int, str]] = {}


def glyph(chars: str, asc: int, rows: str) -> None:
    G[chars] = (chars, asc, rows)


CAP = 9
X = 6

# Capitals
glyph('A', CAP, '.###. #...# #...# #...# ##### #...# #...# #...# #...#')
glyph('B', CAP, '####. #...# #...# #...# ####. #...# #...# #...# ####.')
glyph('C', CAP, '.###. #...# #.... #.... #.... #.... #.... #...# .###.')
glyph('D', CAP, '####. #...# #...# #...# #...# #...# #...# #...# ####.')
glyph('E', CAP, '##### #.... #.... #.... ####. #.... #.... #.... #####')
glyph('F', CAP, '##### #.... #.... #.... ####. #.... #.... #.... #....')
glyph('G', CAP, '.###. #...# #.... #.... #.### #...# #...# #...# .###.')
glyph('H', CAP, '#...# #...# #...# #...# ##### #...# #...# #...# #...#')
glyph('I', CAP, '### .#. .#. .#. .#. .#. .#. .#. ###')
glyph('J', CAP, '....# ....# ....# ....# ....# ....# #...# #...# .###.')
glyph('K', CAP, '#...# #...# #..#. #.#.. ##... #.#.. #..#. #...# #...#')
glyph('L', CAP, '#... #... #... #... #... #... #... #... ####')
glyph('M', CAP, '#.....# ##...## #.#.#.# #..#..# #.....# #.....# #.....# #.....# #.....#')
glyph('N', CAP, '#...# ##..# ##..# #.#.# #.#.# #..## #..## #...# #...#')
glyph('O', CAP, '.###. #...# #...# #...# #...# #...# #...# #...# .###.')
glyph('P', CAP, '####. #...# #...# #...# ####. #.... #.... #.... #....')
glyph('Q', CAP, '.###. #...# #...# #...# #...# #...# #...# #..#. .##.# ....#')
glyph('R', CAP, '####. #...# #...# #...# ####. #.#.. #..#. #...# #...#')
glyph('S', CAP, '.###. #...# #.... #.... .###. ....# ....# #...# .###.')
glyph('T', CAP, '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#.. ..#.. ..#..')
glyph('U', CAP, '#...# #...# #...# #...# #...# #...# #...# #...# .###.')
glyph('V', CAP, '#...# #...# #...# #...# #...# .#.#. .#.#. .#.#. ..#..')
glyph('W', CAP, '#.....# #.....# #.....# #.....# #..#..# #..#..# #.#.#.# ##...## #.....#')
glyph('X', CAP, '#...# #...# .#.#. .#.#. ..#.. .#.#. .#.#. #...# #...#')
glyph('Y', CAP, '#...# #...# .#.#. .#.#. ..#.. ..#.. ..#.. ..#.. ..#..')
glyph('Z', CAP, '##### ....# ...#. ...#. ..#.. .#... .#... #.... #####')

# Lowercase
glyph('a', X, '.###. ....# .#### #...# #...# .####')
glyph('b', CAP, '#.... #.... #.... ####. #...# #...# #...# #...# ####.')
glyph('c', X, '.### #... #... #... #... .###')
glyph('d', CAP, '....# ....# ....# .#### #...# #...# #...# #...# .####')
glyph('e', X, '.###. #...# ##### #.... #.... .###.')
glyph('f', CAP, '..## .#.. .#.. #### .#.. .#.. .#.. .#.. .#..')
glyph('g', X, '.#### #...# #...# #...# #...# .#### ....# ....# .###.')
glyph('h', CAP, '#.... #.... #.... ####. #...# #...# #...# #...# #...#')
glyph('i', CAP, '. # . # # # # # #')
glyph('j', CAP, '... ..# ... ..# ..# ..# ..# ..# ..# ..# ..# ##.')
glyph('k', CAP, '#... #... #... #..# #.#. ##.. #.#. #..# #..#')
glyph('l', CAP, '# # # # # # # # #')
glyph('m', X, '###.##. #..#..# #..#..# #..#..# #..#..# #..#..#')
glyph('n', X, '####. #...# #...# #...# #...# #...#')
glyph('o', X, '.###. #...# #...# #...# #...# .###.')
glyph('p', X, '####. #...# #...# #...# #...# ####. #.... #.... #....')
glyph('q', X, '.#### #...# #...# #...# #...# .#### ....# ....# ....#')
glyph('r', X, '#.## ##.. #... #... #... #...')
glyph('s', X, '.#### #.... #.... .###. ....# ####.')
glyph('t', 8, '.#.. .#.. #### .#.. .#.. .#.. .#.. ..##')
glyph('u', X, '#...# #...# #...# #...# #...# .####')
glyph('v', X, '#...# #...# #...# .#.#. .#.#. ..#..')
glyph('w', X, '#.....# #.....# #..#..# #..#..# #.#.#.# .#...#.')
glyph('x', X, '#...# .#.#. ..#.. ..#.. .#.#. #...#')
glyph('y', X, '#...# #...# #...# #...# #...# .#### ....# ....# .###.')
glyph('z', X, '##### ...#. ..#.. .#... #.... #####')

# Figures
glyph('0', CAP, '.###. #...# #...# #..## #.#.# ##..# #...# #...# .###.')
glyph('1', CAP, '.#. ##. .#. .#. .#. .#. .#. .#. ###')
glyph('2', CAP, '.###. #...# ....# ....# ...#. ..#.. .#... #.... #####')
glyph('3', CAP, '.###. #...# ....# ....# ..##. ....# ....# #...# .###.')
glyph('4', CAP, '...#. ..##. .#.#. #..#. #..#. ##### ...#. ...#. ...#.')
glyph('5', CAP, '##### #.... #.... ####. ....# ....# ....# #...# .###.')
glyph('6', CAP, '.###. #...# #.... #.... ####. #...# #...# #...# .###.')
glyph('7', CAP, '##### ....# ....# ...#. ...#. ..#.. ..#.. ..#.. ..#..')
glyph('8', CAP, '.###. #...# #...# #...# .###. #...# #...# #...# .###.')
glyph('9', CAP, '.###. #...# #...# #...# .#### ....# ....# #...# .###.')

# Punctuation and symbols
glyph('!', CAP, '# # # # # # # . #')
glyph('"', CAP, '#.# #.# #.#')
glyph('#', 8, '.#.#. .#.#. ##### .#.#. .#.#. ##### .#.#. .#.#.')
glyph('$', CAP, '..#.. .#### #.#.. #.#.. .###. ..#.# ..#.# ####. ..#..')
glyph('%', CAP, '.#...# #.#..# .#..#. ...#.. ..#... .#..#. #..#.# #...#. ......')
glyph('&', CAP, '.##.. #..#. #..#. .##.. .#... #.#.# #..#. #..#. .##.#')
glyph("'", CAP, '# # #')
glyph('(', CAP, '.# #. #. #. #. #. #. #. .#')
glyph(')', CAP, '#. .# .# .# .# .# .# .# #.')
glyph('*', 8, '..#.. #.#.# .###. #.#.# ..#..')
glyph('+', 6, '..#.. ..#.. ##### ..#.. ..#..')
glyph(',', 1, '.# .# #.')
glyph('-', 4, '####')
glyph('.', 1, '#')
glyph('/', CAP, '....# ...#. ...#. ..#.. ..#.. ..#.. .#... .#... #....')
glyph(':', X - 1, '# . . . #')
glyph(';', X - 1, '.# .. .. .. .# .# #.')
glyph('<', 7, '...# ..#. .#.. #... .#.. ..#. ...#')
glyph('=', 5, '#### .... ####')
glyph('>', 7, '#... .#.. ..#. ...# ..#. .#.. #...')
glyph('?', CAP, '.###. #...# ....# ....# ...#. ..#.. ..#.. ..... ..#..')
glyph('@', CAP, '.####. #....# #.##.# #.#.## #.#.## #..#.# #..... #....# .####.')
glyph('[', CAP, '## #. #. #. #. #. #. #. ##')
glyph('\\', CAP, '#.... .#... .#... ..#.. ..#.. ..#.. ...#. ...#. ....#')
glyph(']', CAP, '## .# .# .# .# .# .# .# ##')
glyph('^', CAP, '..#.. .#.#. #...#')
glyph('_', 0, '#####')
glyph('`', CAP, '#. .#')
glyph('{', CAP, '..# .#. .#. .#. #.. .#. .#. .#. ..#')
glyph('|', CAP, '# # # # # # # # # # # #')
glyph('}', CAP, '#.. .#. .#. .#. ..# .#. .#. .#. #..')
glyph('~', 5, '.##.# #.##.')

# Typography used by the game's text
glyph('·', 5, '## ##')  # middle dot
glyph('‘', CAP, '.# #. ##')
glyph('’', CAP, '## .# #.')
glyph('\u201c', CAP, '.#..# #..#. ##.##')  # left double quote
glyph('\u201d', CAP, '##.## .#..# #..#.')  # right double quote
glyph('–', 4, '#####')
glyph('—', 4, '#########')
glyph('…', 1, '#.#.#')
glyph('×', 6, '#...# .#.#. ..#.. .#.#. #...#')
glyph('′', CAP, '# # #')
glyph('″', CAP, '#.# #.# #.#')
glyph('←', 6, '..#.... .##.... ####### .##.... ..#....')
glyph('→', 6, '....#.. ....##. ####### ....##. ....#..')
glyph('↑', 8, '..#.. .###. #.#.# ..#.. ..#.. ..#.. ..#.. ..#..')
glyph('↓', 8, '..#.. ..#.. ..#.. ..#.. ..#.. #.#.# .###. ..#..')

SPACE_ADVANCE = 4  # pixels, including spacing


def bitmap(rows: str) -> list[str]:
    lines = rows.split()
    width = max(len(line) for line in lines)
    assert all(len(line) == width for line in lines), rows
    return lines


def embolden(lines: list[str]) -> list[str]:
    out = []
    for line in lines:
        cells = list(line + '.')
        for i, ch in enumerate(line):
            if ch == '#':
                cells[i + 1] = '#'
        out.append(''.join(cells))
    return out


def draw(lines: list[str], asc: int):
    pen = TTGlyphPen(None)
    for r, line in enumerate(lines):
        top = (asc - r) * UNITS
        c = 0
        while c < len(line):
            if line[c] != '#':
                c += 1
                continue
            start = c
            while c < len(line) and line[c] == '#':
                c += 1
            x0, x1 = start * UNITS, c * UNITS
            # Clockwise rectangle; abutting runs share winding and fill seamlessly.
            pen.moveTo((x0, top - UNITS))
            pen.lineTo((x0, top))
            pen.lineTo((x1, top))
            pen.lineTo((x1, top - UNITS))
            pen.closePath()
    return pen.glyph()


def build(bold: bool) -> Path:
    order = ['.notdef', 'space', 'nbspace']
    cmap = {0x20: 'space', 0xA0: 'nbspace'}
    glyphs = {}
    metrics = {}
    empty = TTGlyphPen(None).glyph()
    notdef = bitmap('##### #...# #...# #...# #...# #...# #...# #...# #####')
    glyphs['.notdef'] = draw(notdef, CAP)
    metrics['.notdef'] = (6 * UNITS, 0)
    space = (SPACE_ADVANCE + (1 if bold else 0)) * UNITS
    for name in ('space', 'nbspace'):
        glyphs[name] = empty
        metrics[name] = (space, 0)
    for chars, asc, rows in G.values():
        lines = bitmap(rows)
        if bold:
            lines = embolden(lines)
        name = 'uni%04X' % ord(chars)
        order.append(name)
        cmap[ord(chars)] = name
        glyphs[name] = draw(lines, asc)
        metrics[name] = ((len(lines[0]) + 1) * UNITS, 0)

    style = 'Bold' if bold else 'Regular'
    fb = FontBuilder(EM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ASCENT, descent=-DESCENT, lineGap=0)
    fb.setupNameTable(
        {
            'familyName': 'Way Pixel',
            'styleName': style,
            'copyright': 'Original artwork for The Way. SIL Open Font License 1.1.',
            'licenseDescription': 'SIL Open Font License 1.1',
        }
    )
    fb.setupOS2(
        sTypoAscender=ASCENT,
        sTypoDescender=-DESCENT,
        sTypoLineGap=0,
        usWinAscent=ASCENT,
        usWinDescent=DESCENT,
        sxHeight=X * UNITS,
        sCapHeight=CAP * UNITS,
        usWeightClass=700 if bold else 400,
        fsSelection=0x20 if bold else 0x40,
        achVendID='WAY ',
    )
    fb.setupPost()
    fb.font['head'].macStyle = 1 if bold else 0
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f'way-pixel-{style.lower()}.woff2'
    fb.font.flavor = 'woff2'
    fb.save(str(path))
    return path


if __name__ == '__main__':
    for weight in (False, True):
        print(build(weight))
