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

router.use(authenticate as any);

router.post('/', validate(createProjectSchema), projectsController.create as any);
router.get('/', projectsController.list as any);
router.get('/:projectId', projectsController.get as any);
router.put('/:projectId', validate(updateProjectSchema), projectsController.update as any);
router.post('/:projectId/repo', validate(linkRepoSchema), projectsController.linkRepo as any);
router.delete('/:projectId', projectsController.delete as any);

export default router;