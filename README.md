# VSCode extension for connection to Intel oneAPI DevCloud.

#### | [Repository][vsix-repo] | [Issues][vsix-issues] | [Documentation][vsix-docs] |

[vsix-repo]:   <https://github.com/intel/vscode-oneapi-devcloud-connect>
[vsix-issues]: <https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/issues>
[vsix-docs]:   <https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect#readme>


#### | [oneAPI Code Samples][oneapi-samples] | [oneAPI VSCode Extensions][oneapi-samples] | [Intel VSCode Extensions][intel-extensions] |

[oneapi-samples]:    <https://github.com/oneapi-src/oneAPI-samples>
[oneapi-extensions]: <https://marketplace.visualstudio.com/search?term=oneapi&target=VSCode>
[intel-extensions]:  <https://marketplace.visualstudio.com/publishers/intel-corporation>

***

This extension assists with configuring and establishing a VSCode Remote-SSH
connection to the [oneAPI DevCloud](https://devcloud.intel.com/oneapi/)
development environment.

The oneAPI DevCloud cluster does not support VSCode Remote-SSH connections
into the cluster's "login node." However, by creating an SSH tunnel you can
establish a VSCode Remote-SSH session with a oneAPI DevCloud "compute node."
This extension will help you locate and reserve a compute node and establish
an interactive VSCode Remote-SSH session with that compute node.

Without this extension you must perform a [series of manual
steps][manual-remote-ssh] to create the SSH tunnel and an interactive VSCode
Remote-SSH connection to a oneAPI DevCloud compute node.

[manual-remote-ssh]: <https://devcloud.intel.com/oneapi/documentation/connect-with-vscode>

***


## Prerequisites:

* Windows 10 or Linux Ubuntu 18 (currently tested platforms).

* Turn off your VPN (connecting via a VPN is not supported).


### Windows SSH Setup (Direct Internet access)

* Install VSCode 1.56 or later and install the [Remote-SSH
extension.](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh)

* [Install
Cygwin](https://devcloud.intel.com/oneapi/documentation/connect-with-ssh-windows-cygwin)
into the C:\cygwin64 folder. Automated installation is recommended. Make sure
that ssh.exe and nc.exe are present in the /cygwin64/bin folder.

* Create a oneAPI DevCloud account and setup your SSH config file and ssh.exe
Cygwin client [for use with the VSCode Remote-SSH
extension.](https://devcloud.intel.com/oneapi/documentation/connect-with-vscode)

### Linux SSH Setup (Direct Internet access)

* Install VSCode 1.56 or later and install the [Remote-SSH
extension.](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh)

* Create a oneAPI DevCloud account and [setup your SSH config file.](https://devcloud.intel.com/oneapi/documentation/connect-with-vscode)

### If you are behind an SSH proxy

Modify ~/.ssh/config as below
```
Host devcloud.proxy
User <user>
Port 4022
IdentityFile ~/.ssh/devcloud-access-key-<user>.txt
ProxyCommand ssh -T devcloud-via-proxy

# If you must route outgoing SSH connection via a corporate proxy,
# replace PROXY_HOSTNAME and PORT below with the values provided by
# your network administrator.
Host devcloud-via-proxy
User guest
Hostname ssh.devcloud.intel.com
IdentityFile ~/.ssh/devcloud-access-key-<user>.txt
LocalForward 4022 c009:22
ProxyCommand nc -x <proxy_name>:<port> %h %p
################################################################################################

################################################################################################
# DevCloud VSCode config
################################################################################################
Host devcloud-vscode
UserKnownHostsFile /dev/null
StrictHostKeyChecking no
Hostname localhost
User <user>
Port 5022
IdentityFile ~/.ssh/devcloud-access-key-<user>.txt
################################################################################################

################################################################################################
# SSH Tunnel config
################################################################################################
Host *.aidevcloud
User <user>
IdentityFile ~/.ssh/devcloud-access-key-<user>.txt
ProxyCommand ssh -T devcloud.proxy nc %h %p
LocalForward 5022 localhost:22
LocalForward 5901 localhost:5901
################################################################################################

```
proxy_name and port  are, respectively, the hostname and port of the corporate proxy.

### If you copied ssh config file and key file from another machine

Set the correct restrictive permissions on it and on the SSH client config file. To do this, run the following commands in a terminal:

```
chmod 600 ~/.ssh/devcloud-access-key-<user>.txt
chmod 600 ~/.ssh/config
```

### Check Your Connection to the DevCloud Login Node

To be sure that your ssh setup is correct, open a terminal session (Cygwin
terminal on Windows; bash terminal on Linux) and run the `ssh devcloud`
command.


### Install this DevCloud Connection Extension from a VSIX File

Download the latest vsix file from [the releases
page.](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/releases)

To install the vsix file:

* Click the left menu icon for Extensions (1)
* Click button "..." (2)
* Click "Install from VSIX..." button (3)

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/f173026a-33b4-44bc-b9b0-702ffc9d33e3)


## Use the Extension

1. Press `Ctrl+Shift+P ( or View -> Command Palette... )` to open the Command Palette.
2. Type **DevCloud** and select `Intel DevCloud: Setup connection`

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/22faa42a-cb5c-43ab-b37e-f7ad63f37e6c)

3. You may be asked “Are you connecting via proxy?” If you use direct Internet access, select “No”. If you are behind an SSH proxy, select "Yes".

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/3c45a5b8-7cbc-45d3-880d-2fd7c1feba08)

4.You will then be prompted to set a timeout for the job. To use the default value press ESC
![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/81574619/8c2872a2-1fd7-4e2f-b36c-ccdb4f29e92b)

5. Two service terminals will be created within an interval of several
seconds. They are named: `devcloudService1` and `devcloudService2`

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/d2bf8f12-3fd7-41ae-b262-2247ace75f26)

> NOTE: These are service terminals that are being used to facilite your
connection to the oneAPI DevCloud. Do not close them during your DevCloud
session; closing them will interrupt your SSH connection to DevCloud!

6. The second terminal may ask you to add an SSH key fingerprint - type "yes"

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/0bde8ba6-90e0-42b2-a750-c047c11c75d0)

> NOTE: Do not type anything else in the service terminals.

7. If the connection setup is successful, a corresponding message will appear
and you can connect to the compute node on DevCloud via the VSCode Remote-SSH
extension.

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/11194224-0d41-4a1d-b440-dbc5291caf1e)

8. Using the VSCode command palette, start the "Remote-SSH" extension and
select the `devcloud-vscode` option.

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/2911875a-cc86-452b-98a9-f189c223073b)

You should now be in your DevCloud home folder in an interactive computer node.

9. For access to documentation type Ctrl+Shift+P and find command `Intel Devcloud: Get Help`


## End the Connection

To close your connection to the oneAPI DevCloud and kill your interactive session:

* Close the DevCloud VSCode Remote-SSH window.

* Close both service terminals:

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/329e8f4f-1bb1-4ee8-9a3b-fd06ba436311)


## Known Issues

* Do not create two or more connections at the same time. This case is not
supported at this time.

* If you have any alive PBS jobs on Devcloud (running or in the job queue),
this extension will not connect to Devcloud.
