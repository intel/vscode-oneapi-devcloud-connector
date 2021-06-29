VSCode extension for connection to Intel oneAPI DevCloud.

At this time the extension supports Windows host with direct Internet access. Linux and connection via proxy will support later.

Preparing steps:
1. Windows OS with direct access to Internet. PVN must be switched off!
2. Install VSCode and Remote-SSH extension
3. Install Cygwin to the C:\cygwin64 folder: https://devcloud.intel.com/oneapi/documentation/connect-with-ssh-windows-cygwin/ 
4. Get account for DevCloud and setup ssh config file and ssh.exe Cygwin client into Remote-SSH exention: https://devcloud.intel.com/oneapi/documentation/connect-with-vscode/
5. Install from VSIX DevCloud connection extension 

Work with extension.
1. Type Ctrl+Shift+P and find command "Intel DevCloud: Setup connection"
2. Enter the command.
3. Wait for several seconds. The VSCode terminal "DevCloud Tunnel 2" will grant access to compute node.
4. Open "Remote-SSH" extention and push "devcloud-vscode" button.
5. Wait for several seconds. You are in the your home directory in DevCloud. 
