import { Router } from 'express';
import { projectsController } from './projects.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createProjectSchema,
  updateProjectSchema,
  linkRepoSchema,
} from './projects.schemas';

const router = Router();

router.post('/', authenticate as any, validate(createProjectSchema), projectsController.create as any);
router.get('/', authenticate as any, projectsController.list as any);
router.get('/:projectId', authenticate as any, projectsController.get as any);
router.put('/:projectId', authenticate as any, validate(updateProjectSchema), projectsController.update as any);
router.post('/:projectId/repo', authenticate as any, validate(linkRepoSchema), projectsController.linkRepo as any);
router.delete('/:projectId', authenticate as any, projectsController.delete as any);

export default router;