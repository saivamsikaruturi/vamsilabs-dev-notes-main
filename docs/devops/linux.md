# Linux

**Linux Commands**

| command                                    | Description                                                                                       |
|--------------------------------------------|---------------------------------------------------------------------------------------------------|
| mkdir                                      | Create a new directory with given name                                                            |
| ls                                         | List the content in the directory                                                                 |
| cd                                         | Change to directory                                                                               |
| touch                                      | Create empty files                                                                                |
| cat > fileName                             | Create a new file & write content into file “& Ctrl+D to save                                     |
| cat fileName                               | Display content of a file                                                                         |
| cat file1 file2 file 3                     | Copy 2 file and write it into a new file                                                          |
| pwd                                        | Current working directory                                                                         |
| cp                                         | Copy a file into a new file. cp file3.txt file4.txt                                               |
| mv                                         | Moves a file/directory                                                                            |
| head                                       | The top ten lines of a file. sudo head vamsi.txt                                                  |
| tail                                       | Get last 10 lines of a file                                                                       |
| tae                                        | Reverse order of contents of a file                                                               |
| more                                       | Similar to cat, we can display large content by using Enter                                       |
| id                                         | Display id of user /group                                                                         |
| vi                                         | Text editor                                                                                       |
| grep                                       | Search pattern                                                                                    |
| diff                                       | This command is used to display the differences in the files by comparing the files line by line. |
| ping                                       | Status of server                                                                                  |
| history                                    | Review all commands                                                                               |
| hostname                                   | To know the host name of the server                                                               |
| hostname -i                                | Ip address                                                                                        |
| ch mod                                     | Change the user/group permission to access files ch mod u =r file2.txt                            |
| nl                                         | Display the line numbers                                                                          |
| wc                                         | No. of lines ,words ,characters                                                                   |
| uniq                                       | Remove duplicates of file content                                                                 |
| It will remove only continuous duplicates. |                                                                                                   |
| rmdir                                      | Remove the specified directory if the directory is empty                                          |
| Rm                                         | Remove file/directory.                                                                            |
| chown                                      | Assign directory/file to a specific user                                                          |

**User Creation in Linux**:

**To create user groups:** sudo groupadd groupName

sudo useradd **username**

sudo passwd **password**

**To get all users list** cat /etc/passwd

**To Delete a user**: sudo userdel -r username

**To delete group**: sudo groupdel groupName

**Mapping a user to a group**: sudo usermod -a -G groupName username

File Permissions:

1.Read (r) 2.Write(w) 3.Execute (x)

3 Roles- Owner, Group, Others

ll -> command to know the permissions of file/folders in the root

ls -l -> to know the file /folder permissions in the current directory

drwx r-x user, group, others, d -> type of file