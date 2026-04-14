import { describe, it, expect } from "@jest/globals";
import router from "app/routes/manager.routes.js";
import authenticate from "app/authorization/authorization.js";
import requireManager from "app/authorization/requireManager.js";
import {
  getManagerOverview,
  getWorkerBlockingAvailability,
} from "app/controllers/manager.controller.js";

describe("manager routes", () => {
  it("protects overview endpoint with auth + manager middleware", () => {
    const routedLayers = router.stack.filter((layer) => layer.route);
    const overviewLayer = routedLayers.find(
      (layer) => layer.route.path === "/overview" && layer.route.methods.get,
    );

    expect(overviewLayer).toBeDefined();

    const handlers = overviewLayer.route.stack.map((stackLayer) => stackLayer.handle);
    expect(handlers).toContain(authenticate);
    expect(handlers).toContain(requireManager);
    expect(handlers).toContain(getManagerOverview);
  });

  it("protects worker blocking availability endpoint and wires controller", () => {
    const routedLayers = router.stack.filter((layer) => layer.route);
    const availabilityLayer = routedLayers.find(
      (layer) =>
        layer.route.path === "/workers/:userId/blocking-availability"
        && layer.route.methods.get,
    );

    expect(availabilityLayer).toBeDefined();

    const handlers = availabilityLayer.route.stack.map((stackLayer) => stackLayer.handle);
    expect(handlers).toContain(authenticate);
    expect(handlers).toContain(requireManager);
    expect(handlers).toContain(getWorkerBlockingAvailability);
  });
});
