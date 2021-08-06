import * as vscode from 'vscode';
import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

export class DevConnect {
    private firstTerminal!: vscode.Terminal;
    private secondTerminal!: vscode.Terminal;
    private firstLog!: string;
    private secondLog!: string;
    private isUnderProxy!: boolean;
    private userName!: string;
    private nodeName!: string;
    private jobID!: string;
    private cygwinFolderPath!: string;
    private shellPath: string | undefined;

    public async setupConnection(): Promise<void> {
        if (!await this.init()) {
            return;
        }
        if (!await this.connectToHeadNode()) {
            this.firstTerminal.dispose();
            return;
        }
        if (!await this.connectToSpecificNode()) {
            this.firstTerminal.dispose();
            this.secondTerminal.dispose();
            return;
        }
        this.removeTmpFiles();
        return;
    }

    public async closeConnection(): Promise<void> {
        this.firstTerminal?.dispose();
        this.secondTerminal?.dispose();
        vscode.window.showInformationMessage('Connection to devcloud closed');
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

    private async init(): Promise<boolean> {
        if (!await (this.setShell())) {
            return false;
        }
        if (!this.createTmpFiles()) {
            return false;
        }
        const sshConfig = await this.getSshConfig();
        if (!sshConfig) {
            vscode.window.showErrorMessage('Сould not find ssh config file');
            return false;
        }
        if (!await this.getUserNameFromConfig(sshConfig)) {
            return false;
        }

        const tmp = await vscode.window.showQuickPick(['No', 'Yes'], { title: "Are you connecting via proxy?" });
        if (!tmp) {
            return false;
        }
        this.isUnderProxy = tmp === 'Yes' ? true : false;
        return true;
    }

    private async setShell(): Promise<boolean> {
        if (process.platform === 'win32') {
            if (!await this.findCygwinPath()) {
                return false;
            }
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
        const firsrtShellArgs = process.platform === 'win32' ? `-i -l -c "ssh devcloud${this.isUnderProxy === true ? ".proxy" : ""} > ${this.firstLog}"` : undefined;
        const message = 'DEVCLOUD SERVICE TERMINAL. Do not close this terminal during the work! Do not type here!';
        this.firstTerminal = vscode.window.createTerminal({ name: `devcloudService1`, shellPath: this.shellPath, shellArgs: firsrtShellArgs, message: message });

        if (process.platform !== 'win32') {
            this.firstTerminal.sendText(`ssh devcloud${this.isUnderProxy === true ? ".proxy" : ""} > ${this.firstLog}`);
        }
        let jobTimeout = await vscode.window.showInputBox({ placeHolder: "hh:mm:ss", prompt: "Setup job timeout. Press ESC to use the default.", title: "Job timeout" });
        jobTimeout = jobTimeout?.length === 0 ? undefined : jobTimeout;

        if (!await this.checkConnection(this.firstLog, this.firstTerminal)) {
            vscode.window.showErrorMessage("Failed to connect to head node", { modal: true });
            return false;
        }

        this.firstTerminal.sendText(`qsub -I ${jobTimeout !== undefined ? `-l walltime=${jobTimeout}` : ``}`);
        this.firstTerminal.sendText(`qstat -f`);

        if (!await this.getJobID(this.firstLog)) {
            await vscode.window.showErrorMessage("There is already a job in the qsub queue. The extension will not be able to work until they complete.", { modal: true });
            return false;
        }
        return true;
    }

    private async connectToSpecificNode(): Promise<boolean> {
        if (!await this.getNodeName()) {
            return false;
        }
        const message = 'DEVCLOUD SERVICE TERMINAL. Do not close this terminal during the work!';
        const secondShellArgs = process.platform === 'win32' ? `-i -l -c "ssh ${this.nodeName?.concat(`.aidevcloud`)} > ${this.secondLog}"` : undefined;
        this.secondTerminal = vscode.window.createTerminal({ name: `devcloudService2`, shellPath: this.shellPath, shellArgs: secondShellArgs, message: message });

        if (process.platform !== 'win32') {
            this.secondTerminal.sendText(`ssh ${this.nodeName?.concat(`.aidevcloud`)} > ${this.secondLog}`);
        }
        this.secondTerminal.show();
        if (!await this.checkConnection(this.secondLog, this.secondTerminal)) {
            vscode.window.showErrorMessage("Failed to create tunnel to compute node", { modal: true });
            return false;
        }
        vscode.window.showInformationMessage(`Created tunnel to node ${this.nodeName}.\n Now you can connect to devcloud via Remote - SSH.\n Use host devcloud-vscode`, { modal: true });
        return true;
    }

    private async getNodeName(): Promise<boolean> {
        return new Promise(resolve => {
            const timerId = setInterval(async () => {
                const log = this.getLog(this.firstLog);
                if (log) {
                    const idx1 = log.indexOf(`Job Id: ${this.jobID}`);
                    if (idx1 !== -1) {
                        const jobQstat = log.substring(idx1);
                        const matchHostRecord = 'exec_host = ';
                        const idx2 = jobQstat.indexOf(matchHostRecord);
                        const hostRecord = jobQstat.substring(idx2 + matchHostRecord.length);
                        const idx3 = hostRecord.indexOf('/');
                        this.nodeName = hostRecord.substring(0, idx3);
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
            if (process.platform === 'win32') {
                res = readFileSync(join(this.cygwinFolderPath, path)).toString();
            }
            else {
                res = readFileSync(path).toString();
            }
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
            const ind = this.firstLog.indexOf(`/tmp/devcloud.log1`);
            const val = this.firstLog.substr(ind + 0);
            this.firstLog = val;

            this.secondLog = execSync(`${this.shellPath} -i -l -c "mktemp /tmp/devcloud.log2.XXXXXX.txt"`).toString().replace('\n', '');
            const ind2 = this.secondLog.indexOf(`/tmp/devcloud.log2`);
            const val2 = this.secondLog.substr(ind2 + 0);
            this.secondLog = val2;

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
            execSync(`${this.shellPath} -i -l -c "rm ${this.firstLog}"`);
            execSync(`${this.shellPath} -i -l -c "rm ${this.secondLog}"`);
            return true;
        }
        catch (err) {
            return false;
        }
    }

    private async checkConnection(pathToLog: string, terminal: vscode.Terminal): Promise<boolean> {
        return new Promise(resolve => {
            const timerId = setInterval(async () => {
                const checkPattern = terminal === this.firstTerminal ? `${this.userName}@` : `@${this.nodeName}`;
                const log = this.getLog(pathToLog);
                if (log) {
                    const ind = log.match(checkPattern);
                    if (ind !== undefined) {
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

    private async getJobID(pathToLog: string): Promise<boolean> {
        return new Promise(resolve => {
            const timerId = setInterval(async () => {
                const log = this.getLog(pathToLog);
                if (log) {
                    const res = log.match(/qsub:\s+job\s+\S+\s+ready/gi);
                    if (res !== null) {
                        const idx1 = 4 + res[0].indexOf('job ');
                        const idx2 = res[0].indexOf(' ready');
                        this.jobID = res[0].substring(idx1, idx2);
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
    private async getUserNameFromConfig(config: string): Promise<boolean> {
        const idx1 = config.indexOf(`Host devcloud`);
        if (idx1 < 0) {
            vscode.window.showErrorMessage(`ssh config doesn't contain devcloud host`, { modal: true });
            return false;
        }
        const idx2 = config.indexOf(`User`, idx1);
        const idx3 = config.indexOf('\n', idx2);

        this.userName = config.substring(idx2, idx3).replace('User', '').trim();
        return true;
    }

    private async getSshConfig(): Promise<string | undefined> {
        let path: string;
        if (process.platform === 'win32') {
            path = join(this.cygwinFolderPath, `home`, `${process.env.USERNAME}`, `.ssh`, `config`);
        } else {
            path = join(`~`, `.ssh`, `config`);
        }
        if (!existsSync(path)) {
            return undefined;
        }
        return readFileSync(path).toString();
    }
}
