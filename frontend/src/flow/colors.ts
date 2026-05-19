export const PALETTE = [
  0xff4081, 0x40c4ff, 0x69f0ae, 0xffd740, 0xff6d00,
  0xe040fb, 0x00bcd4, 0xeeff41, 0xff1744, 0x1de9b6,
  0xf06292, 0x4fc3f7, 0xaed581, 0xffb74d, 0xce93d8,
  0x80deea, 0xa5d6a7, 0xfff176, 0xef9a9a, 0x80cbc4,
];

export function buildColorMap(groups: string[]): Map<string, number> {
  const map = new Map<string, number>();
  groups.forEach((group, index) => {
    map.set(group, PALETTE[index % PALETTE.length]);
  });
  return map;
}

export function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
