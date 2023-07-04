## Serialization, Deserialization, Externalization

*  Serialization is the conversion of a Java Object into a static stream(sequence) of bytes, which we can then save to a
   database or transfer over a network.

*  Serialization can be achieved by implementing a markable interface named Serializable.

*  Byte stream is platform-independent. This means that once you have a stream of bytes you can convert it into an
   object and run it on any kind of environment.

*  A class is serialized successfully by
   a) by implementing Serializable interface.
   b) All the fields must be serializable. If a field is not serializable, it must be marked transient.
   c) static fields of a class cannot be serialized.

* Deserialization is the conversion of a static stream(sequence) of bytes from a network or database into java object.

Serial Version UID:
* private static final log serialVersionUID = 1L;

* The JVM associates a version number with each serializable class. We use the serialVersionUID attribute to member version of a Serializable class to verify that a loaded class
  and the serializable object are compatible.

* If the UID is not declared then the jvm will generate one automatically at run time. However, it's highly recommended that each class declares its serial UID , as the generated one is
  compiler dependent and thus may result in unexpected InvalidClassExceptions.


Externalization:

* Externalization in java is used whenever you need to customize the serialization mechanism.

* If there are many parameters you dont want to serialize then we cannot make them transient.

* Based on our requirements we can serialize either the whole data field or a piece of the data fiels using the externalizable interface which can
  improve the performance of the application.

* There are 2 methods readExternal(ObjectInput oi) ,writeExternal(ObjectOutput os) , using these methods we can pass the parameters which we want to serialize and deserialize.
 
