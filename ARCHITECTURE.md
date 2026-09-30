# Work Copilot architecture

UI: Side Panel
Reader: user-triggered active-tab DOM extraction
Files: user-selected file/folder input
Context: local session storage
Analysis: dependency-free JavaScript
Calendar: visible-DOM adapter with explicit confirmation
AI: local deterministic engine plus optional offline model adapter

Data flow:

Source -> Reader -> Universal Document -> Work Context -> Analysis -> Suggestion -> User confirmation -> permitted action

There is no remote backend.
There is no cloud storage.
There is no external API.
There is no autonomous background crawler.
