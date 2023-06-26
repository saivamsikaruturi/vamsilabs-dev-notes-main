## Access Modifiers

* public - accessed anywhere in the project.
* private - accessed only in the same class.
* protected - accessed in same package and in child classes of other package.
* default  - accessed in the same package.



## Summary of Access Modifiers
| Visibility                           | public | protected                               | default | private |
|--------------------------------------|--------|-----------------------------------------|---------|---------|
| Within the same class                | yes    | yes                                     | yes     | yes     |
| From child class of same package     | yes    | yes                                     | yes     | no      |
| From Non-child class of same package | yes    | yes                                     | yes     | no      |
| From Child class of outside package  | yes    | yes(we should use child reference only) | no      | no      |
| From non-child of outside package    | yes    | no                                      | no      | no      |


i.e  private < default < protected < public