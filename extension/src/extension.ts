import * as vscode from "vscode";
import * as cp from "child_process";
import { BackendManager } from "./BackendManager";
import { WizardPanel } from "./WizardPanel";

const backend = new BackendManager();
let statusBar: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
  // Status bar item — gives immediate visual feedback in the new window
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.text = "$(loading~spin) PR Helper: Starting…";
  statusBar.tooltip = "PR Helper is starting the Python backend";
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Register command immediately — user can click the status bar or run it from palette
  const cmd = vscode.commands.registerCommand("pr-helper.open", () => {
    if (!backend.port) {
      vscode.window.showInformationMessage(
        "PR Helper is still starting up — please wait a moment and try again."
      );
      return;
    }
    WizardPanel.createOrShow(backend, context.extensionUri, context.secrets);
  });
  context.subscriptions.push(cmd);

  // Wire status bar click to the command
  statusBar.command = "pr-helper.open";

  // Start backend asynchronously — does not block activation
  startBackend(context.extensionPath);
}

export function deactivate() {
  backend.stop();
}

async function startBackend(extensionPath: string) {
  const python = await resolvePython();
  if (!python) {
    setStatusError("Python not found");
    return;
  }

  try {
    await backend.start(extensionPath, python);
    await backend.waitReady();
    statusBar.text = "$(check) PR Helper: Ready";
    statusBar.tooltip = "Click to open PR Helper";
  } catch (err) {
    setStatusError("Backend failed");
    const choice = await vscode.window.showErrorMessage(
      `PR Helper: Failed to start backend — ${String(err)}`,
      "Reload Window",
      "View Docs"
    );
    if (choice === "Reload Window") {
      vscode.commands.executeCommand("workbench.action.reloadWindow");
    } else if (choice === "View Docs") {
      vscode.env.openExternal(
        vscode.Uri.parse("https://github.com/your-org/pr-helper#troubleshooting")
      );
    }
  }
}

function setStatusError(label: string) {
  statusBar.text = `$(error) PR Helper: ${label}`;
  statusBar.tooltip = "PR Helper failed to start — click for details";
  statusBar.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
}

/**
 * Finds a Python 3.9+ executable on PATH, trying "python" then "python3".
 * Returns the executable name, or undefined if not found / too old.
 */
async function resolvePython(): Promise<string | undefined> {
  for (const exe of ["python", "python3"]) {
    const result = tryPython(exe);
    if (result === "ok") return exe;
    if (result === "too-old") {
      await vscode.window
        .showErrorMessage(
          `PR Helper requires Python 3.9 or newer. The "${exe}" on your PATH is too old.`,
          "Download Python"
        )
        .then(openPythonDownload);
      return undefined;
    }
  }

  await vscode.window
    .showErrorMessage(
      "PR Helper requires Python 3.9+, but it was not found on your PATH. " +
        "Install Python and restart VS Code.",
      "Download Python"
    )
    .then(openPythonDownload);
  return undefined;
}

type PythonCheck = "ok" | "too-old" | "not-found";

function tryPython(exe: string): PythonCheck {
  try {
    const raw = cp
      .execFileSync(exe, ["--version"], {
        encoding: "utf8",
        stderr: "pipe",
        timeout: 5000,
      })
      .trim();
    const m = raw.match(/Python (\d+)\.(\d+)/);
    if (!m) return "not-found";
    const [, major, minor] = m.map(Number);
    return major > 3 || (major === 3 && minor >= 9) ? "ok" : "too-old";
  } catch {
    return "not-found";
  }
}

function openPythonDownload(choice: string | undefined) {
  if (choice === "Download Python") {
    vscode.env.openExternal(vscode.Uri.parse("https://www.python.org/downloads/"));
  }
}
