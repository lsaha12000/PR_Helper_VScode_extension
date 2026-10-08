import * as vscode from "vscode";
import * as cp from "child_process";
import * as path from "path";
import * as fs from "fs";

export class BackendManager {
  private proc: cp.ChildProcess | null = null;
  port: number | null = null;

  async start(extensionPath: string, systemPython: string): Promise<void> {
    // Dev mode: backend lives one level up (PR_Helper/backend/).
    // Installed mode: backend is bundled inside the extension directory.
    const devBackend = path.join(extensionPath, "..", "backend", "main.py");
    const isDev = fs.existsSync(devBackend);
    const projectRoot = isDev ? path.join(extensionPath, "..") : extensionPath;
    const backendDir = path.join(projectRoot, "backend");
    const mainPy = path.join(backendDir, "main.py");

    const venvPython = process.platform === "win32"
      ? path.join(projectRoot, ".venv", "Scripts", "python.exe")
      : path.join(projectRoot, ".venv", "bin", "python");

    if (!fs.existsSync(venvPython)) {
      await this.bootstrapVenv(projectRoot, systemPython, venvPython);
    }

    return new Promise((resolve, reject) => {
      this.proc = cp.spawn(venvPython, [mainPy], {
        cwd: backendDir,
        env: process.env,
      });

      const timeout = setTimeout(
        () => reject(new Error("Backend startup timed out after 30 s. Check the Output panel for details.")),
        30_000
      );

      this.proc.stdout?.on("data", (data: Buffer) => {
        const line = data.toString().trim();
        const match = line.match(/READY:PORT=(\d+)/);
        if (match) {
          this.port = parseInt(match[1], 10);
          clearTimeout(timeout);
          resolve();
        }
      });

      this.proc.stderr?.on("data", (data: Buffer) => {
        console.error("[PR Helper backend]", data.toString());
      });

      this.proc.on("error", (err) => {
        clearTimeout(timeout);
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          reject(new Error(
            `Python executable not found at "${venvPython}". ` +
            "Delete the .venv folder and reload the window to recreate it."
          ));
        } else {
          reject(new Error(`Backend process error: ${err.message}`));
        }
      });

      this.proc.on("exit", (code, signal) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          reject(new Error(
            `Backend exited unexpectedly with code ${code}. ` +
            "Run the backend manually: cd backend && python main.py"
          ));
        } else if (signal) {
          clearTimeout(timeout);
          reject(new Error(`Backend was killed by signal ${signal}.`));
        }
      });
    });
  }

  private async bootstrapVenv(
    projectRoot: string,
    systemPython: string,
    venvPython: string
  ): Promise<void> {
    const venvDir = path.join(projectRoot, ".venv");
    const requirementsTxt = path.join(projectRoot, "backend", "requirements.txt");

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "PR Helper",
        cancellable: false,
      },
      async (progress) => {
        // Step 1 — create venv
        progress.report({ message: "Creating Python virtual environment…" });
        await runCommand(systemPython, ["-m", "venv", venvDir], {
          onError: (err) =>
            `Failed to create .venv: ${err}. ` +
            "Make sure Python 3.9+ is installed and venv is available.",
        });

        // Step 2 — upgrade pip silently (avoids "outdated pip" warnings breaking output parsing)
        progress.report({ message: "Upgrading pip…", increment: 30 });
        const pipExe = process.platform === "win32"
          ? path.join(venvDir, "Scripts", "pip.exe")
          : path.join(venvDir, "bin", "pip");
        await runCommand(venvPython, ["-m", "pip", "install", "--quiet", "--upgrade", "pip"], {
          onError: (err) => `pip upgrade failed: ${err}`,
        });

        // Step 3 — install backend requirements
        progress.report({ message: "Installing Python dependencies…", increment: 30 });
        if (!fs.existsSync(requirementsTxt)) {
          throw new Error(
            `backend/requirements.txt not found at "${requirementsTxt}". ` +
            "Is the PR_Helper folder complete?"
          );
        }
        await runCommand(pipExe, ["install", "--quiet", "-r", requirementsTxt], {
          onError: (err) =>
            `pip install failed: ${err}. ` +
            "Check your internet connection or run 'pip install -r backend/requirements.txt' manually.",
        });

        progress.report({ message: "Python environment ready.", increment: 40 });
      }
    );
  }

  async waitReady(maxAttempts = 30): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/health`);
        if (res.ok) return;
      } catch {
        /* not ready yet */
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error(
      "Backend health check failed after 9 s. " +
      "The server may have crashed — check the Developer Tools console for details."
    );
  }

  stop() {
    this.proc?.kill();
    this.proc = null;
    this.port = null;
  }
}

function runCommand(
  exe: string,
  args: string[],
  options: { onError: (stderr: string) => string }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = cp.spawn(exe, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

    proc.on("error", (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        reject(new Error(`Executable not found: "${exe}"`));
      } else {
        reject(new Error(options.onError(err.message)));
      }
    });

    proc.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(options.onError(stderr.trim() || `exit code ${code}`)));
      }
    });
  });
}
