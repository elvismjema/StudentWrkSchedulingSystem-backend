import express from 'express';
import {
  createTimeDiscrepancy,
  listTimeDiscrepancies,
  getTimeDiscrepancyById,
  updateTimeDiscrepancy,
  resolveTimeDiscrepancy,
  deleteTimeDiscrepancy
} from '../controllers/time_discrepancy.controller.js';

const router = express.Router();

// Create a new time discrepancy
router.post('/', createTimeDiscrepancy);

// Get all time discrepancies
router.get('/', listTimeDiscrepancies);

// Get a single time discrepancy by ID
router.get('/:id', getTimeDiscrepancyById);

// Update a time discrepancy
router.put('/:id', updateTimeDiscrepancy);

// Resolve a time discrepancy
router.patch('/:id/resolve', resolveTimeDiscrepancy);

// Delete a time discrepancy
router.delete('/:id', deleteTimeDiscrepancy);

export default router;
