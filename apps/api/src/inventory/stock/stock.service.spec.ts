import { StockService } from './stock.service';

describe('StockService.transferSuggestions', () => {
  function buildService(stocks: unknown[]): StockService {
    const prisma = {
      productStock: { findMany: jest.fn().mockResolvedValue(stocks) },
    };
    return new StockService(prisma as never, {} as never);
  }

  it('suggests transfer from surplus CN → deficit CN for same product', async () => {
    // Product 1: CN A thừa (20, reorder 5 → spare 15), CN B thiếu (2, reorder 5 → need 3)
    const service = buildService([
      {
        productId: 1,
        branchId: 10,
        onHand: 20,
        reorderPoint: 5,
        product: { id: 1, code: 'P1', name: 'SP 1', minStock: null },
        branch: { id: 10, name: 'CN A' },
      },
      {
        productId: 1,
        branchId: 20,
        onHand: 2,
        reorderPoint: 5,
        product: { id: 1, code: 'P1', name: 'SP 1', minStock: null },
        branch: { id: 20, name: 'CN B' },
      },
    ]);

    const suggestions = await service.transferSuggestions();
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      productId: 1,
      fromBranchId: 10,
      toBranchId: 20,
      suggestedQty: 3,
    });
  });

  it('caps suggestedQty at spare when deficit > spare', async () => {
    const service = buildService([
      {
        productId: 2,
        branchId: 10,
        onHand: 11, // rp=5, need spare > rp × 2 = 10 → spare=6
        reorderPoint: 5,
        product: { id: 2, code: 'P2', name: 'SP 2', minStock: null },
        branch: { id: 10, name: 'CN A' },
      },
      {
        productId: 2,
        branchId: 20,
        onHand: 0, // need = 5
        reorderPoint: 5,
        product: { id: 2, code: 'P2', name: 'SP 2', minStock: null },
        branch: { id: 20, name: 'CN B' },
      },
    ]);
    const suggestions = await service.transferSuggestions();
    expect(suggestions[0].suggestedQty).toBe(5); // need=5, spare=6 → cap tại need
  });

  it('no suggestion when reorder point not set AND no minStock', async () => {
    const service = buildService([
      {
        productId: 3,
        branchId: 10,
        onHand: 100,
        reorderPoint: null,
        product: { id: 3, code: 'P3', name: 'x', minStock: null },
        branch: { id: 10, name: 'A' },
      },
      {
        productId: 3,
        branchId: 20,
        onHand: 0,
        reorderPoint: null,
        product: { id: 3, code: 'P3', name: 'x', minStock: null },
        branch: { id: 20, name: 'B' },
      },
    ]);
    const suggestions = await service.transferSuggestions();
    expect(suggestions).toHaveLength(0);
  });

  it('distributes surplus across multiple deficit branches', async () => {
    const service = buildService([
      {
        productId: 4,
        branchId: 1,
        onHand: 30, // rp=5, spare=25
        reorderPoint: 5,
        product: { id: 4, code: 'P4', name: 'x', minStock: null },
        branch: { id: 1, name: 'A' },
      },
      {
        productId: 4,
        branchId: 2,
        onHand: 1, // need 4
        reorderPoint: 5,
        product: { id: 4, code: 'P4', name: 'x', minStock: null },
        branch: { id: 2, name: 'B' },
      },
      {
        productId: 4,
        branchId: 3,
        onHand: 0, // need 5
        reorderPoint: 5,
        product: { id: 4, code: 'P4', name: 'x', minStock: null },
        branch: { id: 3, name: 'C' },
      },
    ]);
    const suggestions = await service.transferSuggestions();
    // 1 suggestion cho CN B (4) + 1 cho CN C (5)
    expect(suggestions).toHaveLength(2);
    const totalSuggested = suggestions.reduce((a, s) => a + s.suggestedQty, 0);
    expect(totalSuggested).toBe(9);
  });
});
