import express from 'express';
import {
  createScheduleTemplate,
  listScheduleTemplates,
  getScheduleTemplateById,
  updateScheduleTemplate,
  setScheduleTemplateActiveStatus,
  deleteScheduleTemplate,
  duplicateScheduleTemplate,
  checkTemplateConflicts,
  publishTemplate,
} from '../controllers/schedule_template.controller.js';
import authenticate from '../authorization/authorization.js';
import requireManager from '../authorization/requireManager.js';

const router = express.Router();

// ── Read (any authenticated user) ────────────────────────────────────────────
router.get('/', [authenticate], listScheduleTemplates);
router.get('/:id', [authenticate], getScheduleTemplateById);
router.get('/:id/conflicts', [authenticate], checkTemplateConflicts);

// ── Write (managers only) ─────────────────────────────────────────────────────
router.post('/', [authenticate, requireManager], createScheduleTemplate);
router.put('/:id', [authenticate, requireManager], updateScheduleTemplate);
router.patch('/:id/active', [authenticate, requireManager], setScheduleTemplateActiveStatus);
router.delete('/:id', [authenticate, requireManager], deleteScheduleTemplate);
router.post('/:id/duplicate', [authenticate, requireManager], duplicateScheduleTemplate);
router.post('/:id/publish', [authenticate, requireManager], publishTemplate);

export default router;

