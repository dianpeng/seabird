Seabird a tree structure query language
======================================

This is a rewrite of a tree query language I've written while at work. The one that I write
at work is not open source and implemented in C++ with some customize need. This version is a
rewrite of the tree query language that I have at work in Javascript.

# Application

The library has a command line tool for doing interactive query. To use it, just need to use
your node like this `node index.js "your_query"`. Then the result will be printted into the
console.


# Browser
It is really easy to put the seabird library into the browser and run it entirely in the client.
I've tested it with Browserify. All you need to do is run command `browserify browser.js -o seabird.js`.
Then the whole library is in seabird.js. To use it here is an simple example

```
html:

<script src='./seabird.js'> </script>

test.js:

const obj    = window.seabirdObject;
const parser = window.seabirdParser;
const eval   = window.seabirdNewEvaluator;
const printer= window.seabirdPrinter;

let data = new obj.String("{\"Hello\":\"World\"}");

// use global variable $ which later on will be passed into object Eval
let ast  = parser("JSON($).Hello");

// new an evaluator , with first argument is a map of global variables and
// second variable represents the dollar sign's data , here our data is a
// string wrapper inside of obj.String. Notes, every normal Javascript
// data needs to be wrapped as internal object representation.
let e    = eval({},data);

// then do the evaluation and get the result
let r    = e.Eval();

// then print the result out
console.log( new printer.StrictJSON().Print(r) );
```

In browser, except builtin function `file` cannot be used, any other function works exactly the same.
And user can extend the library with new builtin functions or data models.

# Language

## 1. Type
The language has a simple type system though it is weak type inheritedly. There're several types :

1. number (double)
2. string
3. null
4. boolean
5. list
6. pair
7. dict
8. function
9. user object

## 2. Grammar
The grammar itself is really similar to xpath but it is essentially a expression language. Any statement
inside of the language result in a value evaluated by the expression.

The query composes of 2 parts a let scope which is used to define variables or intermediate query results ;
and a expression serve as the main query.

Example:

```
## The let scope here defines one or multiple variables
let data = file("my_file.json");# load a file content into memory
let v = JSON(data)           ,  # load data as JSON document
    d = v.**.Age[? this > 18];  # do a recursive search on all the *Age* field inside of JSON when the age field is
                                # larger than 18

# The main query, calculate the average age of all age that is large than 18
avg(d);
```

As you can see the script assembles most of the curly bracket language's expression feature with some specific
syntax added.

Here are simple basic example to show what we can do with the query:
```
let json_data = file("json.file");
let csv_data  = file("csv.file");

let json = JSON(json_data) ,                    # load json
    csv  = CSV (csv_data, " |,|;"),             # load CSV, delimited by space or comma or semicolon
    d1   = json[1:100:2],                       # slice the array with start 1 , end 100 and stride 2
    d2   = json[0].field,                       # access a field called "field" in json object
    d3   = json.*[? (this.@value >= 13 &&       # apply filter on top of every direct child of object *Json*
                     this.@value <= 15) ||      # the filter is indicated by [? filter-expression ]
                     (this.@value * this.@value >= 100)],
    d4   = json.**[? type(this) == "number" && this == 10], # filter out all the number field with value 10, the "**"
                                                            # indicates a recursive descent search
    d5   = 1+2*3-4 / d3[0],                     # do a normal arithmetic expression
    d6   = [1,true,false,null,{"AA":d1}],       # generate a JSON document inline
    d7   = json.**[| this + 10 if type(this) == "number" else null ], # rewrite all the field that is number to be 10 more;
                                                                      # other types rewrite them to null
    d8   = group(d1,fn(x) "A" if(x.@size >10) else "B"),    # do a group based on callback fn
    d9   = reduce(d8,fn(x) x.@size),                        # do a reduce
    d10  = fn(x) x if x <= 1 else fn(x-1) + fn(x-2),        # write a fibonacci recursive function to be used later
    d11  = regex_match("more and more","/more/");           # do regex matching


# output the final query result
[
csv,
d1,
d2,
d3,
d4,
d5,
d6,
d7,
d8,
d9,
d10(10), # calculate fibonacci number
d11
]
```

For more example, please see query inside of the example.

## 3. Builtins

1. type
2. str
3. num
4. int
5. list
6. dict
7. has
8. new_regex
9. regex_match
10. sum
11. avg
13. min
14. max
15. substr
16. trim
17. split
18. lower
19. upper
20. range
21. genlist
22. gendict
23. filter
24. map
25. group
26. reduce
27. file


# Extension
The library allows user to plugin any types of tree structure data for querying purpose. The builtin one supports JSON
and CSV style. But it is easy to wrap XML,Yaml or other tree structure data into the library for querying purpose.


# Misc
The library is fully Javascript based and it nearly doesn't depend anything on Node.js except following library :
1) util
2) assert
3) fs (if runs in browser, this one can be changed to use ajax or whatever to get the data)

These dependency has been separated into folder lib/port so it is rather easy to port the library into browser.


# License
MIT
