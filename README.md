# csu-scheduler
Course Scheduler for Colorado State University. Create, save, edit, and view all your schedules in one simple page.

Initially based off of the old [stevens-scheduler](https://github.com/danielheyman/stevens-scheduler/tree/492b2c443bf3134244bebd456db5610b199934d6) but with a lot more features.

Features include:  
-Saving, loading, and sharing schedules  
-Rearranging saved schedules  
-Dark<=>Light mode slider in top left  
-Automatic schedule generation - change mode to automatic and you can start off with an already valid schedule  
-Notes that can be saved alongside schedules  
-And a lot more  

Currently in Beta.


# Want to contribute or use for your college?
A lot of work has been done to make this easily adaptable to other institutions.  
In order to do so, fork and rename [csu-scheduler](https://github.com/Shizcow/csu-scheduler), the source repo.   
In config.js there are some instructions on how to get started. Read through each section and follow the instructions.  
This project also uses minification. You must minify to have this work without modification.  
See below for instructions.  
After that, little source modification will be required. Direct any questions to csu-scheduler maintainers.  
  
  
# Minifying
Currently, minifying is required by the source and the website will not work without it.
Here's how the minify structure is layed out, which if followed means no modification here:

- HTML:
    - index_source.html -> index.html
  
- CSS:
    - style.css -> style.min.css
    - style_dark.css -> style_dark.min.css
  
- JS:
    - GA.js, config.js, index.js, librequests.js, init.js, apputil.js, UIschedule.js, UIright.js, UIsavebar.js, selectionLogic.js, mounted.js -> min.js
    - Note: you'll need a jsminifier that works with ES6. Google Closure Compiler is a nice choice.


Once you find good packages that work on your machine, it might be a good idea to set up a pre-commit git hook.
This allows you to executute "git commit" whenever you want to build and test the site. Note, without passing any
options to git commit, it won't actually commit, but only build and ask for options.


Here's an example of a pre-commit hook for this project, which may or may not work on your machine:
```
#!/bin/sh

echo "minifying files..."


echo "->minifying JS..."

closure-compiler --compilation_level SIMPLE_OPTIMIZATIONS --js_output_file min.js --js GA.js config.js index.js librequests.js init.js apputil.js UIschedule.js UIright.js UIsavebar.js selectionLogic.js mounted.js

if [[ $? != 0 ]]; then 
    exit 1
fi


echo "->minifying CSS..."

uglifycss --output style.min.css style.css
if [[ $? != 0 ]]; then 
    exit 1
fi
uglifycss --output style_dark.min.css style_dark.css
if [[ $? != 0 ]]; then 
    exit 1
fi


echo "->minifying HTML..."
minify -o index.html index_source.html
if [[ $? != 0 ]]; then 
    exit 1
fi


echo "minifing was a success"
```
