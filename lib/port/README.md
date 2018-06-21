This folder contains wrapper for porting purpose of this library. Basically port it into the Browser.
The library itself is nearly self dependent except it uses some builtin Node.js library , ie 
1) util
2) assert
3) fs

and also the source file is orgnized using Node.js's module system. To ease the pain of porting, I make
these thin wrapper for the library.
