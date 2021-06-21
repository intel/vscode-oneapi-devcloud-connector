import * as vscode from 'vscode';

export class DevConnect {
    private firstTerminal!: vscode.Terminal;
    private secondTerminal!: vscode.Terminal;
    private logPath: string | undefined;
    private isUnderProxy: boolean;
    private nodeName: string | undefined;

    constructor() {
        this.logPath = undefined;
        this.nodeName = undefined;
        this.isUnderProxy = false;
        return;
    }

    public setupConnect(): void {
        if (!this.initTerminasl()) {
            //error handling
        }
        if (!this.connectToHeadNode()) {
            //error handling
        }
        // if (!this.connectToSpecificNode()) {
        //     //error handling
        // }
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
        const firsrtShellArgs = '-i -l -e "devcloud.sh"';
        this.firstTerminal = vscode.window.createTerminal(`DevCloud Tunnel 1`, shellPath, firsrtShellArgs);
        this.firstTerminal.show();
        const secondShellArgs = '-i -l';
        this.secondTerminal = vscode.window.createTerminal(`DevCloud Tunnel 2`, shellPath, secondShellArgs);
        this.secondTerminal.show();
        return true;
    }
    private getTerminalPath(): string {
        return "C:\\cygwin64\\bin\\bash.exe";
    }
    private connectToHeadNode(): boolean {
        this.firstTerminal.sendText("qsub -I");
        this.firstTerminal.sendText("qstat -f");
        return true;
    }

    private connectToSpecificNode(): boolean {
        this.nodeName = (this.getNodeName()).concat('.aidevcloud');
        this.secondTerminal.sendText(`ssh ${this.nodeName}`);
        return true;
    }

    private getLog(): string {
        return '';
    }
    private removeLog(): boolean {
        return true;
    }
    private getNodeName(): string {
        return '';
    }

}