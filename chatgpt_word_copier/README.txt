ARIA ChatGPT to Word Copier
===========================

Purpose:
  ChatGPT tab mein numbered prompts send kare, response/code capture kare,
  aur local MS Word .docx document mein append kare.

Setup:
  1. ARIA server run rakhein: http://127.0.0.1:5050
  2. Chrome/Edge mein extensions page open karein.
  3. Developer mode ON.
  4. Load unpacked.
  5. Ye folder select karein:
     browser_extension/chatgpt_word_copier

Use:
  1. ChatGPT conversation open karein.
  2. Extension icon click karein.
  3. Start number aur End number set karein.
  4. Run This Tab dabayein.

Behavior:
  - Sends 1, waits for response complete/stable.
  - Saves response/code blocks into Word.
  - Sends 2, repeats until end number.
  - Save Latest button current latest response ko Word mein save karta hai.

Output:
  Documents/ARIA_Docs/GPT_Word_Copier/

Safety:
  It only works inside ChatGPT pages and writes to local Word files through ARIA server.
