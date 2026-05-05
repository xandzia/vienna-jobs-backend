# vienna-jobs-backend
AI-powered job search with Claude API and RAG pipeline
<img width="852" height="1098" alt="schreme" src="https://github.com/user-attachments/assets/9a41b104-da13-41f4-b63d-154a798e654d" />
User schreme
<img width="872" height="1041" alt="user_schreme" src="https://github.com/user-attachments/assets/3c49a90e-906d-429b-865f-5b7b24fcd26b" />

User clicks "Find new jobs"
         │
         ▼
   Last scrape < 6h ago?
   ├── YES → Use existing jobs from DB
   │         (only for matching (for user), scraping skip)
   └── NO  → Scrape + embed new jobs, then match
