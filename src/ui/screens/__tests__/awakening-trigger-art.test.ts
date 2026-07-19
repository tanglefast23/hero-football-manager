import { readFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';

const ART_DIRECTORY = join(
  process.cwd(),
  'src',
  'ui',
  'screens',
  'awakening-trigger-visuals',
);

const SCENE_ART_FILES = [
  'GlowingCaterpillarVisual.tsx',
  'WaterBottleVisual.tsx',
  'rhythmic-cpr.tsx',
  'magic-sponge.tsx',
  'smelling-salt-super-sneeze.tsx',
  'ice-pack-moons.tsx',
  'strong-man-strong-drink.tsx',
  'RunawaySprinklerVisual.tsx',
  'BuzzingShinGuardVisual.tsx',
  'MeteoriteInTheBootVisual.tsx',
  'BallOfDestinyVisual.tsx',
  'ConfettiCannonVisual.tsx',
  'ChosenFeatherVisual.tsx',
  'HeroThermometerVisual.tsx',
  'DefibrillatorStarVisual.tsx',
] as const;

const ART_FILES = [...SCENE_ART_FILES, 'AwakeningTriggerCalloutIcon.tsx'] as const;
const SMOOTH_VECTOR_PRIMITIVES = /\b(?:Circle|Line|Path|RoundedRect|Text|matchFont)\b/;
const RAW_HEX_COLOR = /#[0-9a-f]{3,8}\b/i;

function numericLiteral(node: ts.Expression): number | null {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (
    ts.isPrefixUnaryExpression(node)
    && node.operator === ts.SyntaxKind.MinusToken
    && ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text);
  }
  return null;
}

function pixelCoordinateErrors(fileName: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const errors: string[] = [];

  function visit(node: ts.Node) {
    if (ts.isArrayLiteralExpression(node) && node.elements.length >= 5) {
      const firstFour = node.elements.slice(0, 4).map(element => numericLiteral(element as ts.Expression));
      if (firstFour.every(value => value !== null)) {
        const [x, y, width, height] = firstFour as number[];
        if (![x, y, width, height].every(Number.isInteger)) {
          errors.push(`fractional pixel block at ${node.getStart(sourceFile)}`);
        }
        if (x < 0 || y < 0 || width <= 0 || height <= 0) {
          errors.push(`invalid pixel block at ${node.getStart(sourceFile)}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return errors;
}

describe('awakening trigger pixel-art contract', () => {
  test.each(ART_FILES)('%s uses the shared palette and hard pixel blocks', fileName => {
    const source = readFileSync(join(ART_DIRECTORY, fileName), 'utf8');

    expect(source).toContain('AwakeningPixelSprite');
    expect(source).not.toMatch(SMOOTH_VECTOR_PRIMITIVES);
    expect(source).not.toMatch(RAW_HEX_COLOR);
    expect(source).not.toContain('fontFamily');
    expect(source).not.toContain('rotate');
    expect(pixelCoordinateErrors(fileName, source)).toEqual([]);
    if ((SCENE_ART_FILES as readonly string[]).includes(fileName)) {
      expect(source).toContain('scale={2}');
      expect(source).not.toContain('scale={1}');
      expect(source).not.toContain('scale={3}');
      expect(source).not.toContain('scale={4}');
    }
  });

  it('places later triggers on the opaque beige card but leaves the caterpillar unframed', () => {
    const source = readFileSync(join(ART_DIRECTORY, 'AwakeningTriggerVisual.tsx'), 'utf8');

    expect(source).toContain('const CARD_SIZE = 80');
    expect(source).toContain('color={P.ink}');
    expect(source).toContain('color={P.cream}');
    expect(source.match(/<Rect/g)).toHaveLength(2);
    expect(source).toContain(
      "if (visual === 'caterpillar') {\n    return <GlowingCaterpillarVisual x={x} y={y} />;",
    );
  });
});
