# Security model

## Network
The extension contains no fetch/XHR/WebSocket code and declares no host permissions. It does not call external services.

## Browser permissions
- activeTab: temporary access to the tab explicitly acted on by the user.
- sidePanel: UI.
- scripting: user-triggered injection of the local reader into the active tab.
- storage: local session context.

The extension does not request cookies, history, downloads, bookmarks, management, native messaging, webRequest, microphone or camera.

## Data flow
User action -> current tab or selected local file -> local parsing -> local context -> local analysis -> UI.

No automatic mailbox crawling and no automatic filesystem crawling are implemented.

## Mutations
Document and email content are never modified or sent. Calendar automation is available only from a user-confirmed task and operates through the visible current calendar page. If the calendar DOM cannot be identified, no action is performed.

## AI
No cloud AI is used. The repository contains deterministic local analysis. A semantic LLM can only be introduced as an offline, preapproved local model/runtime package; the extension must never download it.

## Corporate deployment
Do not bypass browser or endpoint management policies. Use the organization's approved extension deployment mechanism.
