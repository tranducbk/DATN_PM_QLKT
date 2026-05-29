import fs from 'fs';
import path from 'path';
import {
  DANH_HIEU_CA_NHAN_HANG_NAM,
  DANH_HIEU_DON_VI_HANG_NAM,
  DANH_HIEU_HCCSVV,
  DANH_HIEU_HCBVTQ,
  DANH_HIEU_DAC_BIET,
  DANH_HIEU_MAP,
  CONG_HIEN_HE_SO_GROUPS,
  CONG_HIEN_HE_SO_RANGES,
} from '../../src/constants/danhHieu.constants';

const FE_CONSTS_PATH = path.resolve(
  __dirname,
  '../../../FE-QLKT/src/constants/danhHieu.constants.ts'
);

function extractObjectLiteral(
  source: string,
  exportName: string,
  context: Record<string, unknown> = {}
): Record<string, unknown> {
  const pattern = new RegExp(
    `export\\s+const\\s+${exportName}\\s*(?::[^=]+)?=\\s*(\\{[\\s\\S]*?\\})\\s*(?:as\\s+const)?\\s*;`,
    'm'
  );
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`FE source does not export ${exportName} as object literal`);
  }
  const keys = Object.keys(context);
  const values = Object.values(context);
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function(...keys, `return (${match[1]});`);
  return fn(...values) as Record<string, unknown>;
}

describe('danhHieu constants — BE/FE sync', () => {
  // Loaded lazily so a missing FE file produces a single descriptive failure
  // instead of cascading errors across every assertion.
  let feSource: string;

  beforeAll(() => {
    if (!fs.existsSync(FE_CONSTS_PATH)) {
      throw new Error(
        `FE constants file not found at ${FE_CONSTS_PATH}. ` +
          'Update FE_CONSTS_PATH or restore the file.'
      );
    }
    feSource = fs.readFileSync(FE_CONSTS_PATH, 'utf8');
  });

  it('DANH_HIEU_CA_NHAN_HANG_NAM matches', () => {
    expect(extractObjectLiteral(feSource, 'DANH_HIEU_CA_NHAN_HANG_NAM')).toEqual(
      DANH_HIEU_CA_NHAN_HANG_NAM
    );
  });

  it('DANH_HIEU_DON_VI_HANG_NAM: FE is a subset of BE (FE may omit BE-only aliases)', () => {
    const fe = extractObjectLiteral(feSource, 'DANH_HIEU_DON_VI_HANG_NAM');
    for (const [key, value] of Object.entries(fe)) {
      expect((DANH_HIEU_DON_VI_HANG_NAM as Record<string, unknown>)[key]).toBe(value);
    }
  });

  it('DANH_HIEU_HCCSVV matches', () => {
    expect(extractObjectLiteral(feSource, 'DANH_HIEU_HCCSVV')).toEqual(DANH_HIEU_HCCSVV);
  });

  it('DANH_HIEU_HCBVTQ matches', () => {
    expect(extractObjectLiteral(feSource, 'DANH_HIEU_HCBVTQ')).toEqual(DANH_HIEU_HCBVTQ);
  });

  it('DANH_HIEU_DAC_BIET matches', () => {
    expect(extractObjectLiteral(feSource, 'DANH_HIEU_DAC_BIET')).toEqual(DANH_HIEU_DAC_BIET);
  });

  it('CONG_HIEN_HE_SO_GROUPS matches', () => {
    expect(extractObjectLiteral(feSource, 'CONG_HIEN_HE_SO_GROUPS')).toEqual(
      CONG_HIEN_HE_SO_GROUPS
    );
  });

  it('CONG_HIEN_HE_SO_RANGES matches', () => {
    expect(
      extractObjectLiteral(feSource, 'CONG_HIEN_HE_SO_RANGES', {
        CONG_HIEN_HE_SO_GROUPS,
      })
    ).toEqual(CONG_HIEN_HE_SO_RANGES);
  });

  it('DANH_HIEU_MAP entries match for shared codes', () => {
    const feMap = extractObjectLiteral(feSource, 'DANH_HIEU_MAP') as Record<string, string>;
    const sharedCodes = [
      ...Object.values(DANH_HIEU_CA_NHAN_HANG_NAM),
      ...Object.values(DANH_HIEU_HCCSVV),
      ...Object.values(DANH_HIEU_HCBVTQ),
      ...Object.values(DANH_HIEU_DAC_BIET),
    ];
    for (const code of sharedCodes) {
      expect(feMap[code]).toBe((DANH_HIEU_MAP as Record<string, string>)[code]);
    }
  });
});
