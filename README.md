# Work Copilot

Local-first corporate browser extension. No external runtime dependencies.

## Runtime requirements
- Windows 10
- Chromium-based browser with Manifest V3 / Side Panel support
- No Python, Node.js, npm, React or external libraries required to run

## Security model
- No external network requests from the extension
- User-triggered page/file access
- Ephemeral local context by default
- Read/analyze/suggest separated from explicit calendar actions
- No email sending or document modification

## Development
The source is plain HTML/CSS/JavaScript and can be edited with Notepad. No build step is required.

## Important limitation
A genuine local LLM requires an inference runtime and model weights. This repository therefore contains a complete deterministic local assistant and a strict local-model adapter contract, but does not fetch or download model weights at runtime. A model may only be added through an approved offline corporate deployment process.
