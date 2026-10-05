import * as vscode from "vscode";
import * as cp from "child_process";
import { BackendManager } from "./BackendManager";
import { WizardPanel } from "./WizardPanel";

const backend = new BackendManager();

export async function activate(context: vscode.ExtensionContext) {
  const python = await resolvePython();
  if (!python) return; // error already shown

  try {
    await backend.start(context.extensionPath, python);
    await backend.waitReady();
  } catch (err) {
    const choice = await vscode.window.showErrorMessage(
      `PR Helper: Failed to start backend — ${String(err)}`,
      "Reload Window",
      "View Docs"
    );
    if (choice === "Reload Window") {
      vscode.commands.executeCommand("workbench.action.reloadWindow");
    } else if (choice === "View Docs") {
      vscode.env.openExternal(vscode.Uri.parse("https://github.com/your-org/pr-helper#troubleshooting"));
    }
    return;
  }

  const cmd = vscode.commands.registerCommand("pr-helper.open", () => {
    WizardPanel.createOrShow(backend, context.extensionUri);
  });
  context.subscriptions.push(cmd);
}

export function deactivate() {
  backend.stop();
}

/**
 * Finds a Python 3.9+ executable, trying "python" then "python3".
 * Returns the executable name to use, or undefined if not found/too old.
 */
async function resolvePython(): Promise<string | undefined> {
  for (const exe of ["python", "python3"]) {
    const result = tryPython(exe);
    if (result === "ok") return exe;
    if (result === "too-old") {
      await vscode.window.showErrorMessage(
        `PR Helper requires Python 3.9 or newer. The "${exe}" on your PATH is too old.`,
        "Download Python"
      ).then(openPythonDownload);
      return undefined;
    }
    // result === "not-found" → try next candidate
  }

  // Neither "python" nor "python3" found
  await vscode.window.showErrorMessage(
    "PR Helper requires Python 3.9+, but it was not found on your PATH. " +
    "Install Python and restart VS Code.",
    "Download Python"
  ).then(openPythonDownload);
  return undefined;
}

type PythonCheck = "ok" | "too-old" | "not-found";

function tryPython(exe: string): PythonCheck {
  try {
    const raw = cp.execFileSync(exe, ["--version"], { encoding: "utf8", stderr: "pipe" }).trim();
    // "Python 3.11.2"
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
