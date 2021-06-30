import * as vscode from 'vscode';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

export class DevConnect {
    private firstTerminal!: vscode.Terminal;
    private secondTerminal!: vscode.Terminal;
    private firstLog!: string;
    private secondLog!: string;
    private isUnderProxy: boolean;
    private nodeName!: string;
    private cygwinFolderPath!: string;
    private shellPath: string | undefined;

    constructor() {
        this.isUnderProxy = false;
    }

    public async setupConnect(): Promise<void> {
        if (!(await this.init())) {
            return;
        }
        if (!(await this.connectToHeadNode())) {
            vscode.window.showErrorMessage("Failed to connect to head node", { modal: true });
            this.firstTerminal.dispose();
            return;
        }
        if (!(await this.connectToSpecificNode())) {
            vscode.window.showErrorMessage("Failed to connect to specific node", { modal: true });
            this.secondTerminal.dispose();
            return;
        }
        this.removeTmpFiles();
        return;
    }

    public async init(): Promise<boolean> {
        const tmp = await vscode.window.showQuickPick(['Yes', 'No'], { title: "Are you under proxy?" });
        if (!tmp) {
            return false;
        }
        this.isUnderProxy = tmp === 'Yes' ? true : false;

        if (!(await this.findCygwinPath())) {
            return false;
        }
        if (!this.setShell()) {
            return false;
        }
        if (!this.createTmpFiles()) {
            return false;
        }
        return true;
    }

    public setShell(): boolean {
        if (process.platform === 'win32') {
            this.shellPath = join(this.cygwinFolderPath, `bin`, `bash.exe`);
        } else {
            this.shellPath = '/bin/bash';
        }
        if (!existsSync(this.shellPath)) {
            vscode.window.showErrorMessage(`Failed to find a shell binary. Path:${this.shellPath}`, { modal: true });
            return false;
        }
        return true;
    }

    public getHelp(): void {
        const devCloudHelp = `DevCloud Help`;
        vscode.window.showInformationMessage(`Click for more Info`, devCloudHelp).then(selection => {
            if (selection) {
                vscode.env.openExternal(vscode.Uri.parse(`https://devcloud.intel.com/oneapi/get_started/`));
            }
        });
    }

    private async findCygwinPath(): Promise<boolean> {
        if (existsSync(`C:\\cygwin64`)) {
            this.cygwinFolderPath = 'C:\\cygwin64';
            return true;
        } else {
            vscode.window.showInformationMessage(`Could not find path to cygwin bash. Provide it yourself.`);
            const uri = (await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false }));

            if (!uri) {
                vscode.window.showErrorMessage("Failed to find a path to cygwin", { modal: true });
                return false;
            }
            this.cygwinFolderPath = uri[0].fsPath;
            return true;
        }
    }

    private async connectToHeadNode(): Promise<boolean> {
        const firsrtShellArgs = `-i -l -c "ssh devcloud${this.isUnderProxy === true ? ".proxy" : ""} > ${this.firstLog}"`;
        const message = 'DEVCLOUD TUNNEL TERMINAL. Do not close this terminal! Do not type here!';
        this.firstTerminal = vscode.window.createTerminal({ name: `DevCloud Tunnel 1`, shellPath: this.shellPath, shellArgs: firsrtShellArgs, message: message });
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
        const message = 'DEVCLOUD TUNNEL TERMINAL. Do not close this terminal!';
        const secondShellArgs = `-l -c "ssh ${this.nodeName?.concat(`.aidevcloud`)} > ${this.secondLog}"`;
        this.secondTerminal = vscode.window.createTerminal({ name: `DevCloud Tunnel 2`, shellPath: this.shellPath, shellArgs: secondShellArgs, message: message });
        this.secondTerminal.show();
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
            res = readFileSync(join(this.cygwinFolderPath, path)).toString();
            return res;
        }
        catch (err) {
            return res;
        }
    }

    private createTmpFiles(): boolean {
        if (!this.createLogFiles()) {
            vscode.window.showErrorMessage("Failed to create Log Files", { modal: true });
            return false;
        }
        return true;
    }

    private createLogFiles(): boolean {
        try {
            this.firstLog = execSync(`${this.shellPath} -i -l -c "mktemp /tmp/devcloud.log1.XXXXXX.txt"`).toString().replace('\n', '');
            this.secondLog = execSync(`${this.shellPath} -i -l -c "mktemp /tmp/devcloud.log2.XXXXXX.txt"`).toString().replace('\n', '');
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
            unlinkSync(join(this.cygwinFolderPath, this.firstLog));
            unlinkSync(join(this.cygwinFolderPath, this.secondLog));
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