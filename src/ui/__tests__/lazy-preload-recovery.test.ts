const mockLoadPixelSheets = jest.fn();

jest.mock('react', () => ({ lazy: (load: unknown) => load }));
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('@shopify/react-native-skia/lib/module/web', () => ({
  LoadSkiaWeb: () => Promise.resolve(),
}));
jest.mock('../../render/sprites/pixel-sheets', () => ({
  loadPixelSheets: () => mockLoadPixelSheets(),
}));
jest.mock('../SkiaSurfaceImplementations', () => ({
  TrainingDrillModal: () => null,
  PlayerGiftCelebration: () => null,
}));

describe.each([
  [
    'training',
    '../LazyTrainingDrillModal',
    'preloadTrainingDrillModal',
    'LazyTrainingDrillModal',
  ],
  [
    'gift',
    '../LazyPlayerGiftCelebration',
    'preloadPlayerGiftCelebration',
    'LazyPlayerGiftCelebration',
  ],
])('%s artwork preload recovery', (_name, path, preloadName, lazyName) => {
  beforeEach(() => {
    jest.resetModules();
    mockLoadPixelSheets.mockReset();
    mockLoadPixelSheets
      .mockRejectedValueOnce(new Error('temporary sprite download failure'))
      .mockResolvedValue({});
  });

  it('keeps optional warmup failure from becoming an unhandled rejection', async () => {
    const module = require(path) as Record<string, () => Promise<unknown>>;
    await expect(module[preloadName]()).resolves.toBeUndefined();
  });

  it('retries on the first actual opening after a failed warmup', async () => {
    const module = require(path) as Record<string, () => Promise<unknown>>;
    await module[preloadName]().catch(() => undefined);

    await expect(module[lazyName]()).resolves.toEqual({
      default: expect.any(Function),
    });
    expect(mockLoadPixelSheets).toHaveBeenCalledTimes(2);
  });

  it('shares successful in-flight work between warmup and opening', async () => {
    mockLoadPixelSheets.mockReset().mockResolvedValue({});
    const module = require(path) as Record<string, () => Promise<unknown>>;
    await Promise.all([
      module[preloadName](),
      module[preloadName](),
      module[lazyName](),
    ]);
    expect(mockLoadPixelSheets).toHaveBeenCalledTimes(1);
    await module[lazyName]();
    expect(mockLoadPixelSheets).toHaveBeenCalledTimes(1);
  });
});
