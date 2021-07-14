VSCode extension for connection to Intel oneAPI DevCloud.

***
This extension simplifies connection to DevCloud with VSCode.

Current way of connection requires manual work of creating tunnel to compute node to use VSCode: https://devcloud.intel.com/oneapi/documentation/connect-with-vscode/

The extension automates this process and creates tunnel by one command.

***


## Prerequisites:
Extension supports OS Windows and Linux Ubuntu (tested platforms).

Direct access to Internet required. 

Extension also supports access via proxy, but this feature is not working because currently tunnel creating via proxy is not supported by DevCloud.

Work through VPN is not supported. Switch off VPN on the host machine (i.e. that you use for connection to DevCloud).

### Windows ssh setup
1. Install VSCode and Remote-SSH extension
2. Install Cygwin to the C:\cygwin64 folder: https://devcloud.intel.com/oneapi/documentation/connect-with-ssh-windows-cygwin/ 
   Automated installation is recommended. Make sure that ssh.exe and nc.exe are present in /cygwin64/bin folder.
3. Get account for DevCloud and setup ssh config file and ssh.exe Cygwin client into Remote-SSH extension: https://devcloud.intel.com/oneapi/documentation/connect-with-vscode/

### Linux ssh setup
1. Install VSCode and Remote-SSH extension
2. Get account for DevCloud and setup ssh config file: https://devcloud.intel.com/oneapi/documentation/connect-with-vscode/

### Check connection to DevCloud login node
To be sure that your ssh setup is correct, open terminal (Cygwin terminal on Windows / bash terminal on Linux) and run "ssh devcloud" command. 

### Install the DevCloud connection extension from VSIX
Download vsix file from latest release: https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/releases

Install vsix:

* Click the left menu icon for Extensions (1)
* Click button "..." (2)
* Click "Install from VSIX..." button (3)

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/f173026a-33b4-44bc-b9b0-702ffc9d33e3)


## Setup connection to DevCloud.
1. Press `Ctrl+Shift+P ( or View -> Command Palette... )` to open the Command Palette.
2. Type **Intel DevCloud** and select `Intel DevCloud: Setup connection`
3. Next, two terminals will be created. The second terminal may ask to add SSH key fingerprint - type "yes"
>NOTE: Do not close the terminals created by the extension - this will interrupt the connection to DevCloud!

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/fb903680-d8d8-11eb-843b-5f8a7f0290a8)


4. If the connection setup is successful, a corresponding message will appear and then you can  connect to the compute node on DevCloud via the vscode ssh extension. To do this, open "Remote-SSH" extension and push "devcloud-vscode" button.

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/cdabf180-d8da-11eb-8e84-493a97c4302e)

5. For access to documentation type Ctrl+Shift+P and find command `Intel Devcloud: Get Help`

