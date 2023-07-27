Topics:

Arrays
Prefix Sum
Binary Search
Two Pointers
Time and Space Complexity
Auxiliary Space and In Memory Space

Arrays:
* Collection of "Similar Type of Data Elements" stored in a "contiguous location".

Operations:

Case 1: Unsorted Array

Search:
a=[5 2 1 3 4 6 -2]
num = 5
nun index of num in a[] , if not found return -1

Approach:
Traverse each value one by one and check if a[i
 == num
 Best case:O(1) , num == a[0]
 Worst Case: O(N), Element not found
Operation   Time   Space

Search       O(N)    O(1)
Insert
Delete


SubArray: Contiguous Smaller Array of Large Array

a[] = [5,1,3,2,4,6]
ex: [1,3] :YES , [1,3,2] :YES [1,3,4] : NO

SubSequence:
Smaller Array from the Larger Array, Does not Necessarily Contiguous But ORDER must be maintained.

Eg:
[1,3] :YES
[1,3,2] : YES
[1,3,4] : YES
[1,3,6,4] : NO
[1,

SubSet: ANY COMBINATION
Smaller Subset of Array. Does Not Necessarily Contiguous and OrdrvDoes not matter.
Eg:
[1,3,5]: YES
[5,1,3]: YES



