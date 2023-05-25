# Linux

**Linux Commands**

| S. No  | command                | Description                                                                                       |
|--------|------------------------|---------------------------------------------------------------------------------------------------|
| 1      | mkdir                  | Create a new directory with given name                                                            |
| 2      | ls                     | List the content in the directory                                                                 |
| 3      | cd                     | Change to directory                                                                               |
| 4      | touch                  | Create empty files                                                                                |
| 5      | cat > fileName         | Create a new file & write content into file “& Ctrl+D to save                                     |
| 6      | cat fileName           | Display content of a file                                                                         |
| 7      | cat file1 file2 file 3 | Copy 2 file and write it into a new file                                                          |
| 8      | pwd                    | Current working directory                                                                         |
| 9      | cp                     | Copy a file into a new file. cp file3.txt file4.txt                                               |
| 10     | mv                     | Moves a file/directory                                                                            |
| 11     | head                   | The top ten lines of a file. sudo head vamsi.txt                                                  |
| 12     | tail                   | Get last 10 lines of a file                                                                       |
| 13     | tae                    | Reverse order of contents of a file                                                               |
| 14     | more                   | Similar to cat, we can display large content by using Enter                                       |
| 15     | id                     | Display id of user /group                                                                         |
| 16     | vi                     | Text editor                                                                                       |
| 17     | grep                   | Search pattern                                                                                    |
| 18     | diff                   | This command is used to display the differences in the files by comparing the files line by line. |
| 19     | ping                   | Status of server                                                                                  |
| 20     | history                | Review all commands                                                                               |
| 21     | hostname               | To know the host name of the server                                                               |
| 22     | hostname -i            | Ip address                                                                                        |
| 23     | ch mod                 | Change the user/group permission to access files ch mod u =r file2.txt                            |
| 24     | nl                     | Display the line numbers                                                                          |
| 25     | wc                     | No. of lines ,words ,characters                                                                   |
| 26     | uniq                   | Remove duplicates of file content                                                                 |
| It will remove only continuous duplicates. |                        |                                                                                                   |
| 27     | rmdir                  | Remove the specified directory if the directory is empty                                          |
| 28     | Rm                     | Remove file/directory.                                                                            |
| 29     | chown                  | Assign directory/file to a specific user                                                          |

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