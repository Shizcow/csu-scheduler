# Dead Project
Well, it was fun while it lasted. CSU has removed schedule day/time data from
public records. Bringing this back would require havng a user log into RamWeb via
this tool, which is too much of a security risk IMO. Sad.

# csu-scheduler
Course Scheduler for Colorado State University. Create, save, edit, and view all your schedules in one simple page.

Initially based off of the old [stevens-scheduler](https://github.com/danielheyman/stevens-scheduler/tree/492b2c443bf3134244bebd456db5610b199934d6) but with a lot more features.

Features include:  
-Saving, loading, and sharing schedules  
-Rearranging saved schedules  
-Dark<=>Light mode slider in top left  
-Automatic schedule generation - change mode to automatic and you can start off with an already valid schedule  
-Notes that can be saved alongside schedules  
-Locks to keep closed courses on the board, or to keep in place in automatic mode  


# Want to contribute or use for your college?
A lot of work has been done to make this easily adaptable to other institutions.  
In order to do so, fork and rename [csu-scheduler](https://github.com/Shizcow/csu-scheduler), the source repo.   
In config.js there are some instructions on how to get started. Read through each section and follow the instructions.

# Building
Simply run `make` to build. This will minify all JavaScript, CSS, and HTML.
