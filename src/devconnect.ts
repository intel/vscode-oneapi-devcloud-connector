import * as vscode from 'vscode';
import * as tmp from 'tmp';
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

export class DevConnect {
    private firstTerminal!: vscode.Terminal;
    private secondTerminal!: vscode.Terminal;
    private log!: string;
    private terminalScript!: tmp.FileResult;
    private isUnderProxy: boolean;
    private nodeName: string | undefined;

    constructor() {
        this.nodeName = undefined;
        this.isUnderProxy = false;
        this.createTmpFiles();
        return;
    }

    public setupConnect(): void {
        if (this.initTerminasl()) {
            //error handling
        }
        if (!this.connectToHeadNode()) {
            //error handling
        }
        if (!this.connectToSpecificNode()) {
            //error handling
        }
        //this.removeTmpFiles();
        return;
    }

    public getHelp(): void {
        const devCloudHelp = 'DevCloud Help';
        vscode.window.showInformationMessage('Click for more Info', devCloudHelp).then(selection => {
            if (selection) {
                vscode.env.openExternal(vscode.Uri.parse('https://devcloud.intel.com/oneapi/get_started/'));
            }
        });
    }

    private initTerminasl(): boolean {
        const shellPath = this.getTerminalPath();
        const firsrtShellArgs = `-i -l -e ${this.terminalScript.name}`;
        this.firstTerminal = vscode.window.createTerminal(`DevCloud Tunnel 1`, shellPath, firsrtShellArgs);
        this.firstTerminal.show();
        const secondShellArgs = '-i -l';
        this.secondTerminal = vscode.window.createTerminal(`DevCloud Tunnel 2`, shellPath, secondShellArgs);
        this.secondTerminal.show();

        return true;
    }

    private getTerminalPath(): string {
        return "C:\\cygwin64\\bin\\bash.exe";//TODO: try to find in a default location, if missing - ask the user to specify a location
    }

    private connectToHeadNode(): boolean {
        this.firstTerminal.sendText("qsub -I");
        this.firstTerminal.sendText("qstat -f");
        return true;
    }

    private async connectToSpecificNode(): Promise<boolean> {
        await this.getNodeName();
        this.secondTerminal.sendText(`ssh ${this.nodeName}`);
        return true;
    }

    private async getNodeName(): Promise<void> {
        return new Promise(resolve => {
            const timerId = setInterval(async () => {
                console.log('tick');
                const log = this.getLog();
                if (log) {
                    const ind = log.indexOf('exec_host = ');
                    if (ind !== -1) {
                        const val = log.substr(ind + 12);
                        const ind2 = val.indexOf('/');
                        this.nodeName = val.substr(0, ind2).concat('.aidevcloud');
                        clearInterval(timerId);
                        resolve();
                    }
                }
            }, 1000);
            setTimeout(() => { clearInterval(timerId); }, 30000);
        });
    }

    private getLog(): string | undefined {
        let res = undefined;
        try {
            const path = "C:\\cygwin64".concat(this.log);
            res = readFileSync(path).toString();
            return res;
        }
        catch (err) {
            return res;
        }
    }

    private createTmpFiles(): boolean {
        this.createLogFile();
        this.createTerminalScript();
        return true;
    }

    private createTerminalScript(): boolean {
        //TODO: 
        this.terminalScript = tmp.fileSync();
        const script = `echo "DEVCLOUD TUNNEL TERMINAL. Do not close this terminal! Do not type here!"; ssh devcloud${this.isUnderProxy === true ? ".proxy" : ""} > ${this.log}`;
        writeFileSync(this.terminalScript.name, script);
        return true;
    }

    private createLogFile(): boolean {
        this.log = execSync("C:\\cygwin64\\bin\\mktemp /tmp/devcloud.log.XXXXXX.txt").toString().replace('\n', '');//TODO:
        return true;
    }

    public removeTmpFiles(): boolean {
        if (!this.removeLog()) {
            return false;
        }
        return true;
    }

    private removeLog(): boolean {
        this.log = execSync(`C:\\cygwin64\\bin\\rm ${this.log}`).toString().replace('\n', '');//TODO:
        return true;
    }
}