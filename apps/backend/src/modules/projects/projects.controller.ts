import { Response, NextFunction } from 'express';
import { ProjectsService } from './projects.service';
import { AuthenticatedRequest } from '../../shared/types';
import { sendSuccess, sendCreated, sendNoContent } from '../../shared/utils/response';
import { requireParam } from '../../shared/utils/request';

const projectsService = new ProjectsService();

export const projectsController = {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const project = await projectsService.createProject(req.user.userId, req.body);
      sendCreated(res, project, 'Project created');
    } catch (e) { next(e); }
  },

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const projects = await projectsService.getProjects(req.user.userId);
      sendSuccess(res, projects);
    } catch (e) { next(e); }
  },

  async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const project = await projectsService.getProject(
        requireParam(req, 'projectId'),
        req.user.userId
      );
      sendSuccess(res, project);
    } catch (e) { next(e); }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const project = await projectsService.updateProject(
        requireParam(req, 'projectId'),
        req.user.userId,
        req.body
      );
      sendSuccess(res, project, 200, 'Project updated');
    } catch (e) { next(e); }
  },

  async linkRepo(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const project = await projectsService.linkRepository(
        requireParam(req, 'projectId'),
        req.user.userId,
        req.body
      );
      sendSuccess(res, project, 200, 'Repository linked');
    } catch (e) { next(e); }
  },

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await projectsService.deleteProject(
        requireParam(req, 'projectId'),
        req.user.userId
      );
      sendNoContent(res);
    } catch (e) { next(e); }
  },
};
