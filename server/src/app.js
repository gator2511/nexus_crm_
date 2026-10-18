   import express from 'express';
   import cors from 'cors';
import { programsRouter } from './routes/programs.js';
import { staffRouter } from './routes/staff.js';
import { studentApplicationsRouter } from './routes/studentApplications.js';
import { studentOffersRouter } from './routes/studentOffers.js';
   import {enquiryRouter} from './routes/enquiries.js';
   import {studentAuthRouter} from './routes/auth.js';
   import {studentSignupRouter} from './routes/signup.js';
   import {requireStudent} from './auth.js';
   import {createStudentQualificationRouter} from './routes/studentQualification.js';


   export function createApp() {
     const app = express();
     app.use(cors({ origin: process.env.APP_URL || 'http://localhost:5173' }));
     app.use('/api/student/documents', express.json({ limit: '14mb' }));
     app.use(express.json({ limit: '50kb' }));

     app.get('/api/health', (_req, res) => res.json({ ok: true }));
     app.use('/api/programs', programsRouter);
     app.use('/api/staff', staffRouter);
     app.use('/api/enquiries', enquiryRouter);
     app.use('/api/student', studentAuthRouter);
     app.use('/api/student', studentSignupRouter);
     app.use('/api/student', studentApplicationsRouter);
     app.use('/api/student', studentOffersRouter);
     app.use('/api/student/qualification',
      createStudentQualificationRouter(requireStudent));


     // Unknown API paths
     app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found.' }));

     // Errors: known ones keep their status; anything else is logged and hidden.
     // eslint-disable-next-line no-unused-vars
     app.use((err, _req, res, _next) => {
       if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid request.' });
       if (err.status && err.status < 500) return res.status(err.status).json({ message: err.message, ...(err.extra || {}) });
       console.error(err);
       return res.status(500).json({ message: 'Something went wrong. Please try again.' });
     });

     return app;
   }