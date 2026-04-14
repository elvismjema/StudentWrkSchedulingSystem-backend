import { jest } from '@jest/globals';
import request from "supertest";

jest.mock("../app/models", () => ({
  sequelize: {
    sync: jest.fn(),
  },
  Sequelize: {
    Op: jest.fn(),
  },
}));

describe("server", () => {
  let app;

  beforeAll(async () => {
    app = (await import("../server.js")).default;
  });

  it("responds with welcome message", async () => {
    await request(app)
      .get("/")
      .expect(200)
      .then((response) => {
        expect(response.body.message).toBe("Welcome to bezkoder application.");
      });
  });
});
