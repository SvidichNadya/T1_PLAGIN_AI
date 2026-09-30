# Deployment on a restricted Windows 10 workstation

## Required runtime
- Windows 10
- Chromium-based browser supporting Manifest V3 and Side Panel
- No Python
- No Node.js
- No npm
- No React
- No package manager
- No runtime download

## Installation
1. Obtain the approved extension package through the corporate software-distribution process.
2. If local unpacked extensions are explicitly permitted, open the browser extension management page and use the organization's approved developer/unpacked-extension procedure.
3. Load the repository directory containing manifest.json.
4. Pin/open Work Copilot.
5. Test on a non-sensitive page before using corporate data.

If extension installation is controlled by enterprise policy, the extension must be deployed by the responsible administrator. Do not circumvent the policy.

## Runtime verification
- Extension opens its Side Panel.
- Current-page import works only after a user action.
- Selected file import works locally.
- No external network request is required.
- Calendar action requires explicit confirmation and a visible calendar page.

## Local AI
The current repository intentionally does not download model weights. Model files and an inference runtime, if approved, must be supplied as part of an offline corporate deployment package.
