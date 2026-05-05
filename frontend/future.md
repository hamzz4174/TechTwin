Member 4: Teacher Queries Page

Page where teachers see student queries:

Grouped per subject they handle.

Columns: Student Name, Question, Date, Status, Reply.

Teachers can click → "Reply" → type answer → save to database.

API used:

GET /api/queries/subject/:subjectId

POST /api/queries/reply (save teacher’s reply).

Member 5: AI Reply Integration

Integrate AI model (e.g., GPT) for auto-replies:

When a student submits a query → system first tries AI → saves AI’s response.

If AI can’t answer, status remains "pending teacher".

Workflow:

POST /api/queries → triggers AI → saves reply in DB.

Reply stored in aiReply column (separate from teacher reply).

Frontend (student chatbot page) shows AI reply instantly if available.