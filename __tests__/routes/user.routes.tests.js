const mockAuthenticate = jest.fn((req, res, next) => next());
const mockRequireManager = jest.fn((req, res, next) => next());
const mockUsersController = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  deactivateUser: jest.fn(),
};

jest.mock("../../app/authorization/authorization.js", () => ({
  __esModule: true,
  default: mockAuthenticate,
}));

jest.mock("../../app/authorization/requireManager.js", () => ({
  __esModule: true,
  default: mockRequireManager,
}));

jest.mock("../../app/controllers/user.controller.js", () => ({
  __esModule: true,
  default: mockUsersController,
}));

const router = require("../../app/routes/user.routes.js").default;

describe("user routes auth protection", () => {
  it("protects deactivate endpoint with auth and manager middleware", () => {
    const routedLayers = router.stack.filter((layer) => layer.route);
    const deactivateLayer = routedLayers.find(
      (layer) => layer.route.path === "/:id/deactivate" && layer.route.methods.patch,
    );

    expect(deactivateLayer).toBeDefined();

    const handlers = deactivateLayer.route.stack.map((stackLayer) => stackLayer.handle);
    expect(handlers).toContain(mockAuthenticate);
    expect(handlers).toContain(mockRequireManager);
  });
});
