# NEO4J

**Creating a node**:

CREATE (movie:MOVIES {id:1,name:”RRR”,”releaseDate:”2022-11-20”} ) return movie;

But CREATE can create duplicate node. So better use MERGE .

MERGE (movie:MOVIES {id:1,name:”RRR”,”releaseDate:”2022-11-20”} ) return movie

**Creating a Relationship:**

create (p:Person{name:"Tom"})-[:Follows]->(:Person{name:"Cruise"}) return p

create (p:Person{name:"Tom"})-[:Follows{since:"1956"}]->(:Person{name:"Cre"}) return p

**MATCH (a:Cities), (b:Theaters)WHERE a.city= b.cityMERGE (a)-[r:HOLDS]->(b) RETURN a,b**

**Two way Relations ship**(peter follows desmond and bosede)

create p1=(b:Person{name:"Bosede"})<-[:Follows]-(p:Person{name:"Peter"})-[:Follows]->(d:Person{name:"Desmond"}) return p1

**RETREIVE/MATCH:**

1.Match (n:PLAYER) return n.name as playerName, n.height as height;

2.Match (n:PLAYER) where n.name=’James’ return n

3.Match (n:PLAYER {name:”James”} return n

Based on relationship:

MATCH (a:Screens {name:”IMAX} )-[:PLAYS]-> (b:Shows {showId:2} ) with a,b

**UPDATE a parameter in a node**:

Match (n:MODEL) where id(n)=28 set n.modelId=1221 , n.name=”test” return n;

**UPDATE a relationship between nodes**:

Match (n:movies)-[r:directed]->(m:cast) set r.relationship="acted"

**Delete a node**:

match (n :Person {name: ”sai” } ) DETACH DELETE n

**Deleting a parameter in a node or setting a parameter null** :

match(n{name:"Gate"}) set n.occupation=null return n

or

match(n{name:"Gate"}) remove n.occupation return n

// remove all properties for a particular node

match(n{name:"Gate"}) set n={} return n

**Converting integer to string and string to integer**

MATCH(e {name:'Emmanuel'} ), (b {name:'Ben'}) SET e.age = toInteger(e.age), b.age = toString(b.age) RETURN e.name, e.age,b.name, b.age

**Person who has produced,directed and wrote the same movie**

match c=(p:Person)-[:PRODUCED]->(m)<-[:DIRECTED]-(p),(p)-[:WROTE]->(m) return c,m

**Null Checking:**

match(n:Person)-[:ACTED_IN]->(m:Movie) where n.born is not null return distinct n.name,n.born order by n.name desc

**Optional**: returns null if no records matches

optional match(n:Person)-[:EDITED]->(m) return m.title

**Example for Limit :**

//first two best and first two worst

match()-[r:REVIEWED]->(m:Movie) return m.title,r.rating order by r.rating desc limit 2

union all

match()-[r:REVIEWED]->(m:Movie)return m.title,r.rating order by r.rating asc limit 2

**Return as a List:**

match(n)-[:ACTED_IN]->(m:Movie) where n.born =1971 or n.born=1970 return n.born as Year,collect(n.name)

**COUNT, WITH, UNWIND:**

- -- > with is used for assigning and used it for later

1.match (p:Person)-[r:ACTED_IN]->(m:Movie) with p, count(*) as k where k>5 return p

2.WITH [3,4,5,6,8] AS list RETURN list

//unwind --equivalent to flatmap

WITH [1,2,3,4,6] AS x, [4,5,6,7,8] AS y, [5,7,2,3,4] as z UNWIND (x+y+z) AS a RETURN collect (a) AS List

**Remove duplicate:**

with [10,10,6,5,6,7,7,7,8,3,5,4] as list unwind list as k with **distinct** k return collect(k)

**ForEach**:

FOREACH (n IN ['Sunday','Monday', 'Tuesday', 'Wednesday','Thursday', 'Friday', 'Saturday']|

CREATE (d:Day{name:n}) )

AGGREGATE Functions:

1.**COUNT**: to get the number of theaters in a city

match (n:Cities)-[c:HOLDS]->(p:Theaters) return n.city ,count(c) as theatersCount

the output wil be :

n.city theatersCount

Vishakapatnam 2

Mumabi 10

2. **AVERAGE :** to get the average seat price

match (n:Seat) return AVG(toInteger(n.price)) 190

3.**MIN**: to get the minimum seat price

match (n:Seat) return MIN(toInteger(n.price)) 100

4.**MAX**: to get maximum seat price

match (n:Seat) return MAX(toInteger(n.price)) 230

5.**SUM**:

match (n:Seat) return SUM(toInteger(n.price)) 1140

**List Functions**:

1.**Keys** : returns all the properties in a node:

MATCH (a:Cities) WHERE a.city = 'Hyderabad'RETURN keys(a) ["zipcode", "city", "state"]

2.**Labels:** returns all nodes

MATCH (a) WHERE a.name = 'Alice'

RETURN labels(a) Person ,Developer

3.nodes:

MATCH p = (a)-->(b)-->(c)

WHERE a.name = 'Alice' AND c.name = 'Eskil'

RETURN nodes(p)

4. range()

RETURN range(0, 10)

4. reduce : similar to reduce in java 8

MATCH p = (a)-->(b)-->(c)

WHERE a.name = 'Alice' AND b.name = 'Bob' AND c.name = 'Daniel'

RETURN reduce(totalAge = 0, n IN nodes(p) | totalAge + n.age) AS reduction

5.reverse()

WITH [4923,'abc',521, null, 487] AS ids

RETURN reverse(ids)

6. tail() returns a list lresult containing all the elements, excluding the first one, from a list list.

MATCH (a) WHERE a.name = 'Eskil'

RETURN a.array, tail(a.array)

And also we have toBooleanList(), toStringList(), toIntegerList(),toFloatList().

**APOC (Awsome procedure For Cypher)**

**Call apoc.help(“create”) -- to know all the sub functions**

1.Creating a node:

CALL apoc.create.nodes(["Person"], [{name: "Tom Hanks"}]);

2.load json:

Call apoc.load.json(url) yield value unwind value.items as quantity return keys(quantity)

Merge (product: Product {id:quantity.id}) on create set product.title=quantity.title

Merge (p)

3.apoc.do.case --- write query

match (m:Movie) call apoc.do.case([

m.released<2010 and m.released>2000,

'SET m.era="most recent" RETURN m', m.released<2000 and m.released>1990, 'set m.era="recent" return m'],'set m.era="old" return m',{m:m}) yield value return value.m.title as Title ,value.m.released as

Released,value.m.era order by Released

4. apoc.when – read query

match (p:Person)-[:ACTED_IN]->(m:Movie)with distinct p,collect(m) as movies

call apoc.when(SIZE(movies)>5, 'Return

"established" as status'

,'Return "upcoming" as status',{movies:movies}) yield value return p.name as name ,value.status as status

5.apoc.do.when –write query

match (p:Person)-[:ACTED_IN]->(m:Movie)with distinct p,collect(m) as movies

call apoc.do.when(SIZE(movies)>5, 'set p.status=”established”return p’,

,'set p.status= "upcoming" return p',{p:p}) yield value return value.p.name as name ,value.p.status as status

6. load csv file into db

load csv with headers from 'file:///Screens.csv' as row with row

merge(m:Screens{screenId:row.id,screenName:row.name, theathreId:row.TheatreId, screenType:row.ScreenType} )

(or)

load csv with headers from [file:///People.csv](file:///People.csv) as row call apoc.create.node([‘Person’] +case row.label when “ ” then[] else [row.label] end, {name:row.name, born:toInteger(row.born)}) yield node return node.

7.apoc.coll.avg

8.apoc.coll.toSet([list])

9.apoc.coll.sort([list])

10.Sort Nodes:

Match (n:Person) with collect(n) as people return apoc.coll.sortNodes(people, '^name') as output.

11.reverse a collection:

apoc.coll.reverse(collection)

12. check whether the number is in range

apoc.coll.contains(range(1,10),2)

13. split the list into 2:

apoc.coll.split(range(1,100),5)

output: [1,2,3,4,5],[6,7,8,……100]

14. frequencies:

apoc.coll.frequencies([1,3,5,7,9,9]) AS output

output: [ { "count": 1, "item": 1 } , { "count": 1, "item": 3 } , { "count": 1, "item": 5 } , { "count": 1, "item": 7 } , { "count": 2, "item": 9 } ]

15.occurrences

apoc.coll.occurrences([1,2,3,3],2) output-1

16.flatten

return  apoc.coll.flatten([1,2,[3,4]]) as output  -- output:[1,2,3,4]

17. insert

apoc.coll.insert([1,2],2,3) – [1,2,3]

**changing the existing Relationship**:

match p=()-[r:REVIEWED]->()

call apoc.refactor.setType(r,REVIEWED_BY) yield output return count(*)

**Extract nodes using Relationship:**

Match p=()-[r:ACTED_IN] ->()

Call apoc.refactor.extractNode(r,[‘Role’] , ‘HAD_ROLE’,’IN_MOVIE’) yield output return output

**Meta functions**:

1.apoc.meta.graph() --- gives the relationships between all the nodes in the graph format


![Picture_1.png](Picture_1.png)
2. apoc.meta.schema() – gives the details of all nodes in json format.

3.apoc.meta.data() – gives the details of all nodes and its relationship in tabular format

![https://s3-us-west-2.amazonaws.com/secure.notion-static.com/de170fff-45d3-446e-b639-c635cd925a02/image2.png](https://s3-us-west-2.amazonaws.com/secure.notion-static.com/de170fff-45d3-446e-b639-c635cd925a02/image2.png)

4. apoc.meta.stats() – gives the stastics of entire data base.

![https://s3-us-west-2.amazonaws.com/secure.notion-static.com/ecaddf8e-2b9b-4268-8b2a-e1c5d45a494f/image3.png](https://s3-us-west-2.amazonaws.com/secure.notion-static.com/ecaddf8e-2b9b-4268-8b2a-e1c5d45a494f/image3.png)

5. apoc.meta.nodeTypeProperties() – returns all the data types of parameters of all nodes.

![https://s3-us-west-2.amazonaws.com/secure.notion-static.com/23ba4bb0-c422-4448-9928-9fef0763ab02/image4.png](https://s3-us-west-2.amazonaws.com/secure.notion-static.com/23ba4bb0-c422-4448-9928-9fef0763ab02/image4.png)

To Perform batch updates on the graph .Neo4j is a transactional database , which means each operation is bounded by a transaction. And it is durable ,isolated.

call apoc.periodic.iterate("UNWIND

range(1,1000000)

as id return id", "CREATE (:Person {id:id})", {batchSize:1000,iterateList:true,parallel:true})

return { name :"sai",companies:{Capgemini:"Hyderabad",Siemens:"Bnglr"}}

**Map**:

RETURN apoc.map.flatten({

person: {

name: "Cristiano Ronaldo",

club: {

name: "Juventus",

founded: 1897

}

}

}) AS output;

> {
>
>
> "person.club.founded": 1897,
>
> "person.name": "Cristiano Ronaldo",
>
> "person.club.name": "Juventus"
>
> }
>

Setting a parameter using :param

:param data => ({name:"sai"})

return apoc.map.fromPairs([["a",1],["b",2]])

> {
>
>
> "a": 1,
>
> "b": 2
>
> }
>

return apoc.map.fromLists(["a","b"],[1,2])

return apoc.map.fromValues(["a",1,"b",2])

apoc.map.merge -for merging 2 maps

return apoc.map.merge($data,{a:1,b:2})

apoc.map.setKey

return apoc.map.setKey($data,"age",24)

apoc.map.removeKey

return apoc.map.removeKey($data,"name")

Apoc.map.setEntry

return apoc.map.setEntry($data,"city","Bnglr")

Apoc.map.groupBy

match (m:Movies) with collect (m) as movies

return apoc.map.groupBy(movies,"releaseDate")