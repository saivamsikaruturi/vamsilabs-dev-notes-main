void removeDuplicates(List<String list) {

Set = new HashSet();

Iterator<String iterator = list.iterator();

while (iterator.hasNext()) {

Object element = iterator.next();

if (!set.add(element)){

iterator.remove();

}

}

}



import java.util.*;

public class MyClass {

public static void main(String args[]) {

String s="john doe";

char[] ch = s.toCharArray();

Map<Character,Integer map=new HashMap();

for(Character c:ch){

if(map.get(c)==null){

map.put(c,1);

}

else{

map.put(c,map.get(c)+1);

}

}

map.entrySet().stream().filter(e-e.getValue()1).limit(1).map(e-e.getKey()).forEach(System.out::println);

}

}
