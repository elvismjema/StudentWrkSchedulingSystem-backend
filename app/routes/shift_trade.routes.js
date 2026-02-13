import shiftTrades from "../controllers/shift_trade.controller.js";
import authenticate from "../authorization/authorization.js";
import { Router } from "express";

var router = Router();

// Create a new Shift_Trade
router.post("/", [authenticate], shiftTrades.create);

// Retrieve all Shift_Trades
router.get("/", [authenticate], shiftTrades.findAll);

// Retrieve a single Shift_Trade with id
router.get("/:id", [authenticate], shiftTrades.findOne);

// Update a Shift_Trade with id
router.put("/:id", [authenticate], shiftTrades.update);

// Delete a Shift_Trade with id
router.delete("/:id", [authenticate], shiftTrades.delete);

export default router;
