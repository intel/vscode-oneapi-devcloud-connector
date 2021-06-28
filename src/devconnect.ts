import * as vscode from 'vscode';
import { readFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';

export class DevConnect {
    private firstTerminal!: vscode.Terminal;
    private secondTerminal!: vscode.Terminal;
    private firstLog!: string;
    private secondLog!: string;
    private isUnderProxy: boolean;
    private nodeName: string | undefined;

    constructor() {
        this.nodeName = undefined;
        this.isUnderProxy = false;
        this.createTmpFiles();
        return;
    }

    public async setupConnect(): Promise<void> {
        if (!(await this.connectToHeadNode())) {
            vscode.window.showErrorMessage("Failed to connect to head node", { modal: true });
        }
        if (!(await this.connectToSpecificNode())) {
            vscode.window.showErrorMessage("Failed to connect to specific node", { modal: true });
        }
        this.removeTmpFiles();
        return;
    }

    public getHelp(): void {
        const devCloudHelp = `DevCloud Help`;
        vscode.window.showInformationMessage(`Click for more Info`, devCloudHelp).then(selection => {
            if (selection) {
                vscode.env.openExternal(vscode.Uri.parse(`https://devcloud.intel.com/oneapi/get_started/`));
            }
        });
    }


    private getTerminalPath(): string {
        return `C:\\cygwin64\\bin\\bash.exe`;//TODO: try to find in a default location, if missing - ask the user to specify a location
    }

    private async connectToHeadNode(): Promise<boolean> {
        const shellPath = this.getTerminalPath();
        const firsrtShellArgs = `-i -l -c "ssh devcloud${this.isUnderProxy === true ? ".proxy" : ""} > ${this.firstLog}"`;
        const message = 'DEVCLOUD TUNNEL TERMINAL. Do not close this terminal! Do not type here!';
        this.firstTerminal = vscode.window.createTerminal({ name: `DevCloud Tunnel 1`, shellPath: shellPath, shellArgs: firsrtShellArgs, message: message });
        if (!(await this.checkConnection(this.firstLog, this.firstTerminal))) {
            return false;
        }
        this.firstTerminal.sendText(`qsub -I`);
        this.firstTerminal.sendText(`qstat -f`);
        return true;
    }

    private async connectToSpecificNode(): Promise<boolean> {
        if (!(await this.getNodeName())) {
            return false;
        }
        const shellPath = this.getTerminalPath();
        const message = 'DEVCLOUD TUNNEL TERMINAL. Do not close this terminal! Do not type here!';
        const secondShellArgs = `-l -c "ssh ${this.nodeName?.concat(`.aidevcloud`)} > ${this.secondLog}"`;
        this.secondTerminal = vscode.window.createTerminal({ name: `DevCloud Tunnel 2`, shellPath: shellPath, shellArgs: secondShellArgs, message: message });
        if (!(await this.checkConnection(this.secondLog, this.secondTerminal))) {
            return false;
        }
        vscode.window.showInformationMessage(`Connected to ${this.nodeName}. Now you can connect to devcloud via vscode Remote - SSH.`, { modal: true });
        return true;
    }

    private async getNodeName(): Promise<boolean> {
        return new Promise(resolve => {
            const timerId = setInterval(async () => {
                const log = this.getLog(this.firstLog);
                if (log) {
                    const ind = log.indexOf(`exec_host = `);
                    if (ind !== -1) {
                        const val = log.substr(ind + 12);
                        const ind2 = val.indexOf('/');
                        this.nodeName = val.substr(0, ind2);
                        clearInterval(timerId);
                        resolve(true);
                    }
                }
            }, 1000);
            setTimeout(() => {
                clearInterval(timerId);
                resolve(false);
            }, 30000);
        });
    }

    private getLog(path: string): string | undefined {
        let res = undefined;
        try {
            res = readFileSync(`C:\\cygwin64`.concat(path)).toString();
            return res;
        }
        catch (err) {
            return res;
        }
    }

    private createTmpFiles(): boolean {
        this.createLogFiles();
        return true;
    }

    private createLogFiles(): boolean {
        try {
            this.firstLog = execSync(`C:\\cygwin64\\bin\\bash -i -l -c "mktemp /tmp/devcloud.log1.XXXXXX.txt"`).toString().replace('\n', '');
            this.secondLog = execSync(`C:\\cygwin64\\bin\\bash -i -l -c "mktemp /tmp/devcloud.log2.XXXXXX.txt"`).toString().replace('\n', '');
            return true;
        }
        catch (err) {
            return false;
        }
    }

    public removeTmpFiles(): boolean {
        if (!this.removeLogFiles()) {
            return false;
        }
        return true;
    }

    private removeLogFiles(): boolean {
        try {
            unlinkSync(`C:\\cygwin64${this.firstLog}`);
            unlinkSync(`C:\\cygwin64${this.secondLog}`);
            return true;
        }
        catch (err) {
            return false;
        }
    }

    private async checkConnection(pathToLog: string, terminal: vscode.Terminal): Promise<boolean> {
        return new Promise(resolve => {
            const timerId = setInterval(async () => {
                const checkPattern: string = terminal === this.firstTerminal ? `Welcome to the Intel DevCloud for oneAPI Projects!` : `@${this.nodeName}`;
                const log = this.getLog(pathToLog);
                if (log) {
                    const ind = log.indexOf(checkPattern);
                    if (ind !== -1) {
                        clearInterval(timerId);
                        resolve(true);
                    }
                }
            }, 1000);
            setTimeout(() => {
                clearInterval(timerId);
                resolve(false);
            }, 30000);
        });
    }
}