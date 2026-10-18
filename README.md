# nexus-crm-team
Student recruitment CRM for RIC (capstone project)


## UI, course dropdown and staff dashboard

The client includes responsive navigation, course enquiry, student portal, staff login and
a recruitment dashboard. In development, Vite forwards `/api` to Express on port 4000.

1. Configure `server/.env` with `DATABASE_URL`, `SESSION_SECRET` (at least 32 characters),
   `APP_URL` and, for brochure emails, `RESEND_API_KEY` / `MAIL_FROM`.
2. Apply `server/db/schema.sql` **only to a disposable development database**.
   **WARNING: this SQL drops existing CRM tables and data.**
3. Insert RIC-approved courses into `program` with real UUIDs and `is_active=TRUE`.
   The `GET /api/programs` endpoint will populate the enquiry dropdown directly from these records.
   An empty dropdown means no active programs or a failed database/API connection.
4. Create the first staff account with environment variables:
   `INITIAL_STAFF_EMAIL`, `INITIAL_STAFF_NAME`, `INITIAL_STAFF_PASSWORD`
   (12+ characters), and optionally `INITIAL_STAFF_ROLE=manager`.
   From the `server` directory run `node db/createStaff.js`. Do not commit credentials.
5. Start backend (`cd server && npm ci && npm run dev`) and frontend
   (`cd client && npm ci && npm run dev`) in separate terminals.
   Open `http://localhost:5173/enquiry`, `/staff/login`, or `/staff/dashboard`.
6. Staff dashboard `GET /api/staff/dashboard` is protected with signed staff tokens,
   verified against active `staff_user` records; it reads real `prospect` records.
   A student token is not accepted for staff routes.

### Automated verification

Frontend GitHub Actions executes Vitest and the Vite production build.
Backend GitHub Actions runs Abhimanyu and Isha's unit suites and
`test/dashboard.api.test.js` for staff route authentication.
The broader CRM integration suite may remain red until outstanding endpoints
and end-to-end flows are implemented. Passing unit checks **does not**
establish production readiness.

Student application upload/submission, full student profile progression, and
additional staff workflows are still separate integration tasks. An enquiry saved
to PostgreSQL is not proof that a brochure email was delivered: the response
includes `brochureEmailStatus`. Production requires a verified email domain.
