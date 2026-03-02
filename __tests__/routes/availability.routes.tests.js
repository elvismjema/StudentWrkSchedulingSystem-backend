const mockAuthenticate = jest.fn((req, res, next) => next());
const mockAvailabilityController = {
  create: jest.fn(),
  findAll: jest.fn(),
  findAllForUser: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  delete: jest.fn(),
  deleteAll: jest.fn(),
};

jest.mock("../../app/authorization/authorization.js", () => ({
  __esModule: true,
  default: mockAuthenticate,
}));

jest.mock("../../app/controllers/availability.controller.js", () => ({
  __esModule: true,
  default: mockAvailabilityController,
}));

const router = require("../../app/routes/availability.routes.js").default;

describe("availability routes auth protection", () => {
  it("Given: availability routes are registered, When: inspecting route stack, Then: each endpoint includes authentication middleware", () => {
    const routedLayers = router.stack.filter((layer) => layer.route);
    expect(routedLayers.length).toBeGreaterThan(0);

    routedLayers.forEach((layer) => {
      const handlers = layer.route.stack.map((stackLayer) => stackLayer.handle);
      expect(handlers).toContain(mockAuthenticate);
    });
  });
});
