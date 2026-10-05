import * as vscode from "vscode";
import { BackendManager } from "./BackendManager";
import { WizardPanel } from "./WizardPanel";

const backend = new BackendManager();

export async function activate(context: vscode.ExtensionContext) {
  // Check Python availability
  await checkPython();

  // Start the backend server
  try {
    await backend.start(context.extensionPath);
    await backend.waitReady();
  } catch (err) {
    vscode.window.showErrorMessage(`PR Helper: ${String(err)}`);
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

async function checkPython() {
  const { execSync } = await import("child_process");
  try {
    const ver = execSync("python --version 2>&1").toString();
    const match = ver.match(/Python (\d+)\.(\d+)/);
    if (!match || parseInt(match[1]) < 3 || (parseInt(match[1]) === 3 && parseInt(match[2]) < 9)) {
      throw new Error("Python 3.9+ required");
    }
  } catch {
    vscode.window.showErrorMessage(
      "PR Helper requires Python 3.9+. Please install it and ensure it is on your PATH.",
      "Download Python"
    ).then((choice) => {
      if (choice === "Download Python") {
        vscode.env.openExternal(vscode.Uri.parse("https://www.python.org/downloads/"));
      }
    });
  }
}
