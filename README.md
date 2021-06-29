VSCode extension for connection to Intel oneAPI DevCloud.

***
This extension makes it easy to connect and work with Devcloud with vscode.
***


## Prerequisites:
1. Install VSCode and Remote-SSH extension
3. Install Cygwin to the C:\cygwin64 folder: https://devcloud.intel.com/oneapi/documentation/connect-with-ssh-windows-cygwin/ 
4. Get account for DevCloud and setup ssh config file and ssh.exe Cygwin client into Remote-SSH extension: https://devcloud.intel.com/oneapi/documentation/connect-with-vscode/
5. Install from VSIX DevCloud connection extension 

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/76a41d80-d8d6-11eb-92f4-eb060ca845c9)



>At this time the extension supports Windows host with direct Internet access(VPN must be turned off
). Linux and connection via proxy will be supported later.

## Setup connection to DevCloud.
1. Press `Ctrl+Shift+P ( or View -> Command Palette... )` to open the Command Palette.
2. Type **Intel DevCloud** and select `Intel DevCloud: Setup connection`
3. Next, two terminals will be created. The second terminal may ask to add SSH key fingerprint - type "yes"
>NOTE: Do not close the terminals created by the extension - this will interrupt the connection to DevCloud!

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/fb903680-d8d8-11eb-843b-5f8a7f0290a8)


4. If the connection setup is successful, a corresponding message will appear and then you can  connect to the compute node on DevCloud via the vscode ssh extension. To do this, open "Remote-SSH" extension and push "devcloud-vscode" button.

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/cdabf180-d8da-11eb-8e84-493a97c4302e)

5. For access to documentation type Ctrl+Shift+P and find command `Intel Devcloud: Get Help`

