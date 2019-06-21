/* UIschedule.js
This file contains listeners and aux functions directly responsible for updating
the UI in the schedule. That is, if a course is rendered, it's done here

This file contains:
EventListener for escape/delete
>removes app.course and re-renders - used to deselect a course

change_style()
>toggles between dark mode and light mode

creditsOf()
>gets the number of credits a course is worth

genFaculty()
>gets the faculty of a given course, returns it as a string

courseHere()
>Checks if a course section is offered during a given day/hour
>If so, returns a minimal rendering object

convertTime()
>Converts a time string into a float offset value for rendering

autoFilter()
>for automatic mode - removes all 

webclasses()
>takes in a list of courses, filters, and returns only web courses

fetchDescription()
>grabs a course's description from data server and shows it to the user

dayUpdate()
>looks through all courses to be rendered. If any of those courses are on
>a weekend, expand the schedule to show those courses
 */

// remove app.course and re-render
// used to de-select a pending (rendered in blue) course
window.addEventListener("keydown", function (e) {
    if(e.key == "Escape" || e.key == "Delete"){   // when deleted or escaped
	document.getElementById("selectBox").value = "";
	app.course = null;
	app.savedCourseGenerator = "";
	app.courses_generator = null; // force a recalculation to reflect change in app.course
	app.fillSchedule();
    }
})

// this function loads / unloads style_dark.css to switch between dark and light mode
let change_style = function(styleSlider){
    document.styleSheets[1].disabled = !styleSlider.checked;
    localStorage.darkMode = styleSlider.checked.toString(); // see mounted.js for storage value handling on page re/load
}

// gets the numbers of credits hours for a course
app.creditsOf = function(course){
    if(course.creditHours != undefined)
	return course.creditHours;
    if(course.creditHourLow != undefined)
	return course.creditHourLow;
    return course.creditHourHigh;
};

// generates a string which contains course instructors
app.genFaculty = function(course){
    let out = ""
    course.faculty.forEach(function(el){
	out+=el.displayName+", and ";
    });
    return out ? out.substr(0, out.length-6) : "STAFF";
};

// tests whether or not a course is in a day/hour, and if so returns a render object
app.courseHere = function(day, hour, course){
    if (!course) return;
    var res = null;
    // if course is in day&hour, res will become an object with css information
    
    course.meetingsFaculty.forEach(function(meeting){
	let time = meeting.meetingTime;
	if (time.building == 'WS' || !time.beginTime || !time[day]) return;
	var start = this.convertTime(time.beginTime);
	var end = this.convertTime(time.endTime);
	if (Math.trunc(start, 0) != hour-8) return;
	res = {
	    top: start-Math.trunc(start,0),
	    length: end-start,
	    loc: time.building + time.room,
	}
    }.bind(this));
    return res;
};

// converts a time from hour-minute (ex: 1230) format into a float format representing
// the offset between the time value and the top of the schedule
app.convertTime = function(time){
    var minute = time.substr(-2);
    return parseFloat(time.substr(0, time.length-minute.length), 10)+parseFloat(minute)/60-8;
};

// takes a list of courses and returns only the web courses
app.webclasses = function(courses){
    return courses ? courses.filter(function(course){
	return course && (course.meetingsFaculty.map(el => el.meetingTime.building == "ONLINE").reduce((a, b) => (a || b), false));
    }) : [];
};

// fetches and dislpays the description of a course
app.fetchDescription = function(course){
    //first, show description box
    document.getElementById("description-fetch").style.display = "";
    document.getElementById("description-show").style.display = "none";
    document.getElementById("description").style.display = "";
    document.getElementById("description-strong").innerText = course.subject + " " + course.courseNumber + ":";
    var updater = function(text){
	//remove loading message and show description
	var show = document.getElementById("description-show");
	show.innerText = text;
	show.style.display = "";
	document.getElementById("description-fetch").style.display = "none";
    }
    if(!course.description){
	// if it's not loaded, load it and cache it in the course object
	(new Searcher("desc", course.term.toString(), course.courseReferenceNumber.toString())).start(function(response){
	    updater(response);
	    course.description = response;
	});
    } else {
	// if it's already loaded, go ahead and show it
	updater(course.description);
    }
};

// if needed, expands schedule to include Saturdays and Sundays
app.dayUpdate = function(){
    var test = false;
    //first, hide weekends
    if(this.mode == "Automatic"){
	if(app.courses_generator)
	    if(app.courses_generator.data){
		if(app.courses_generator.data[this.course_list_selection]){
		    test = app.courses_generator.data[this.course_list_selection].value;
		    document.getElementById("noSchedWrapper").style.display = "none";
		    if(document.getElementById("schedTbody").children[0].children[1].style.display == "none"){
			for(var i=1; i<=5; ++i){
			    var trs = document.getElementById("schedTbody").children;
			    for(var j=0; j<trs.length; ++j){
				trs[j].children[i].style.display = "";
			    }
			}
		    }
		} else { // no valid schedules - show msg
		    document.getElementById("noSchedWrapper").style.display = "";
		    if(document.getElementById("schedTbody").children[0].children[1].style.display == ""){
			for(var i=1; i<=5; ++i){
			    var trs = document.getElementById("schedTbody").children;
			    for(var j=0; j<trs.length; ++j){
				trs[j].children[i].style.display = "none";
			    }
			}
		    }
		} // let it continue - will wipe saturdays & sundays
	    }
    } else { // Manual
	test = this.selected.concat(app.courses[this.course]);
	document.getElementById("noSchedWrapper").style.display = "none";
	if(document.getElementById("schedTbody").children[0].children[1].style.display == "none"){
	    for(var i=1; i<=5; ++i){
		var trs = document.getElementById("schedTbody").children;
		for(var j=0; j<trs.length; ++j){
		    trs[j].children[i].style.display = "";
		}
	    }
	}
    }
    //then, show only what needed
    if(test != false ? test.map(function(c){ // Any of the courses are held on a Saturday (or Sunday)
	if(!c) return false;
	return c.meetingsFaculty.map(function(m){
	    return m.meetingTime.saturday || m.meetingTime.sunday
	}).reduce(function(a, b){
	    return a || b;
	})
    }).reduce(function(a, b){
	return a || b;
    }, false) : false){
	document.getElementById("schedThead").children[6].style.display = "";
	var trs = document.getElementById("schedTbody").children;
	for(var i=0; i<trs.length; ++i){
	    trs[i].children[6].style.display = "";
	}
    } else {
	document.getElementById("schedThead").children[6].style.display = "none";
	var trs = document.getElementById("schedTbody").children;
	for(var i=0; i<trs.length; ++i){
	    trs[i].children[6].style.display = "none";
	}
    }
    if(test != false ? test.map(function(c){ // Any of the courses are held on a Sunday
	if(!c) return false;
	return c.meetingsFaculty.map(function(m){
	    return m.meetingTime.sunday
	}).reduce(function(a, b){
	    return a || b;
	})
    }).reduce(function(a, b){
	return a || b
    }, false) : false){
	document.getElementById("schedThead").children[7].style.display = "";
	var trs = document.getElementById("schedTbody").children;
	for(var i=0; i<trs.length; ++i){
	    trs[i].children[7].style.display = "";
	}
    } else {
	document.getElementById("schedThead").children[7].style.display = "none";
	var trs = document.getElementById("schedTbody").children;
	for(var i=0; i<trs.length; ++i){
	    trs[i].children[7].style.display = "none";
	}
    }
}
