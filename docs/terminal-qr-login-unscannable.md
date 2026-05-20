# Terminal QR Login Cannot Be Scanned In Yida Terminal

## Summary

Running `openyida login` in the Yida terminal can render a QR code that DingTalk cannot recognize. The terminal output shows a distorted QR image with wrapped or stretched rows, so scanning the code fails before the login flow can continue.

## Environment

- Command: `openyida login`
- Shell: Windows PowerShell inside the Yida terminal
- Platform observed: Windows
- Scanner app: DingTalk

## Reproduction

1. Open the Yida terminal.
2. Run:

   ```powershell
   openyida login
   ```

3. Wait for the terminal QR code to render.
4. Scan the QR code with DingTalk.

## Actual Result

DingTalk cannot recognize the QR code. In the observed terminal, the generated QR code is visually corrupted: the lower rows wrap into a long horizontal bar and the square QR matrix is no longer preserved.

## Expected Result

The terminal QR code should render as a scannable square QR matrix, or the CLI should avoid printing a corrupted QR code and provide a reliable fallback.

## Notes

This report intentionally does not include a code fix. The likely area to inspect is terminal QR rendering in `lib/auth/qr-login.js`, especially the current `qrcode.toString(..., { type: 'terminal', small: true })` output path. The issue appears related to terminal width or ANSI rendering behavior in the Yida terminal on Windows.
