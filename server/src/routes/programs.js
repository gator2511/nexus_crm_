import { Router } from 'express';
import { query } from '../db.js';

export const programsRouter = Router();
programsRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, name, discipline, brochure_url FROM program WHERE is_active = TRUE ORDER BY name, id'
    );
    res.json({ programs: rows });
  } catch (error) { next(error); }
});
