// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';



// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export  function activate(context: vscode.ExtensionContext) {


	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "DevCloud" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	

	context.subscriptions.push(vscode.commands.registerCommand('devcloud.help', () => {
	
		let DevcloudHelp = 'DevCloud Help';
		vscode.window.showInformationMessage('Click for more Info', DevcloudHelp)
		
        .then(selection => {
        if (selection === DevcloudHelp) {
          vscode.env.openExternal(vscode.Uri.parse(
            'https://devcloud.intel.com/oneapi/get_started/'));
      }
    });
	
	}));
	
	context.subscriptions.push(vscode.commands.registerCommand('devcloud.inputCygwinPath', () => {
		vscode.window.showInputBox({prompt: "Enter Cygwin location", placeHolder: "C:\\cygwin64\\bin\\mintty.exe"});
	
    }));

	context.subscriptions.push(vscode.commands.registerCommand('devcloud.createCygwinTerminal', () => {	
		let CygwinTerminal = vscode.window.createTerminal(`Cygwin`,"C:\\cygwin64\\bin\\bash.exe",' -i -l');
		CygwinTerminal.sendText("ssh devcloud");
		CygwinTerminal.show();
		//CygwinTerminal.sendText("qsub -I");
		//vscode.window.showInformationMessage('Type in terminal "ssh devcloud"\n Then wait for connection\n Then type "qsub -I"');
    }));

	context.subscriptions.push(vscode.commands.registerCommand('devcloud.createCygwinTerminal2', () => {	
		let CygwinTerminal2 = vscode.window.createTerminal(`Cygwin`,"C:\\cygwin64\\bin\\bash.exe",' -i -l');
		CygwinTerminal2.show();
		//vscode.window.showInformationMessage('Type in terminal "ssh node.aidevcloud"\n Then wait for connection',{ modal: true });
    }));
	

	context.subscriptions.push();
}

// this method is called when your extension is deactivated
export function deactivate() {}

