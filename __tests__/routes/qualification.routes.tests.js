import { jest } from '@jest/globals';
const mockVerifyToken = jest.fn((req, res, next) => next());
const mockRequireManager = jest.fn((req, res, next) => next());

const mockQualificationController = {
  createQualification: jest.fn(),
  listQualifications: jest.fn(),
  getQualificationById: jest.fn(),
  updateQualification: jest.fn(),
  deleteQualification: jest.fn(),
  uploadQualificationDocument: jest.fn(),
  listStudentsWithQualifications: jest.fn(),
  getStudentQualifications: jest.fn(),
  reviewQualificationDocument: jest.fn(),
};

jest.mock("app/middleware/authJwt.js", () => ({
  __esModule: true,
  verifyToken: mockVerifyToken,
}));

jest.mock("app/authorization/requireManager.js", () => ({
  __esModule: true,
  default: mockRequireManager,
}));

jest.mock("app/controllers/qualification.controller.js", () => ({
  __esModule: true,
  ...mockQualificationController,
}));

import router from "app/routes/qualification.routes.js";

describe("qualification routes middleware", () => {
  it("protects manager review endpoints with auth and manager middleware", () => {
    const routedLayers = router.stack.filter((layer) => layer.route);

    const reviewRoute = routedLayers.find(
      (layer) => layer.route.path === "/user-qualifications/:id/review" && layer.route.methods.put,
    );
    const listStudentsRoute = routedLayers.find(
      (layer) => layer.route.path === "/students/qualifications" && layer.route.methods.get,
    );

    expect(reviewRoute).toBeDefined();
    expect(listStudentsRoute).toBeDefined();

    const reviewHandlers = reviewRoute.route.stack.map((stackLayer) => stackLayer.handle);
    const listHandlers = listStudentsRoute.route.stack.map((stackLayer) => stackLayer.handle);

    expect(reviewHandlers).toContain(mockVerifyToken);
    expect(reviewHandlers).toContain(mockRequireManager);
    expect(listHandlers).toContain(mockVerifyToken);
    expect(listHandlers).toContain(mockRequireManager);
  });
});
