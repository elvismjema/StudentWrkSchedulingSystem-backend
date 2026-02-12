import express from 'express';
import {
  createScheduleTemplate,
  listScheduleTemplates,
  getScheduleTemplateById,
  updateScheduleTemplate,
  setScheduleTemplateActiveStatus,
  deleteScheduleTemplate
} from '../controllers/schedule_template.controller.js';

const router = express.Router();

// Create a new schedule template
router.post('/', createScheduleTemplate);

// Get all schedule templates with optional filters
router.get('/', listScheduleTemplates);

// Get a single schedule template by ID
router.get('/:id', getScheduleTemplateById);

// Update a schedule template
router.put('/:id', updateScheduleTemplate);

// Set schedule template active status
router.patch('/:id/active', setScheduleTemplateActiveStatus);

// Delete a schedule template
router.delete('/:id', deleteScheduleTemplate);

export default router;
