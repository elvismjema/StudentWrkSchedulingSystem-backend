import { describe, it, expect } from "@jest/globals";
import router from "../../app/routes/availability.routes.js";
import authenticate from "../../app/authorization/authorization.js";
import requireAdmin from "../../app/authorization/requireAdmin.js";
import availabilityController from "../../app/controllers/availability.controller.js";

describe("availability routes auth protection", () => {
  it("Given: availability routes are registered, When: inspecting route stack, Then: each endpoint includes authentication middleware", () => {
    const routedLayers = router.stack.filter((layer) => layer.route);
    expect(routedLayers.length).toBeGreaterThan(0);

    routedLayers.forEach((layer) => {
      const handlers = layer.route.stack.map((stackLayer) => stackLayer.handle);
      expect(handlers).toContain(authenticate);
    });
  });

  it("Given: delete-all availability route, When: inspecting middleware, Then: admin guard is present", () => {
    const routedLayers = router.stack.filter((layer) => layer.route);
    const deleteAllLayer = routedLayers.find(
      (layer) => layer.route.path === "/" && layer.route.methods.delete,
    );

    expect(deleteAllLayer).toBeDefined();

    const handlers = deleteAllLayer.route.stack.map((stackLayer) => stackLayer.handle);
    expect(handlers).toContain(authenticate);
    expect(handlers).toContain(requireAdmin);
    expect(handlers).toContain(availabilityController.deleteAll);
  });
});
