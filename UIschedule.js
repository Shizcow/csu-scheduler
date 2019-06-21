app.totalCredits = function(){
    return this.selected.reduce(function(acc, cur){
	return acc+app.creditsOf(cur);
    }, 0);
};

app.creditsOf = function(course){
    if(course.creditHours != undefined)
	return course.creditHours;
    if(course.creditHourLow != undefined)
	return course.creditHourLow;
    return course.creditHourHigh;
};

app.genFaculty = function(c){
    let out = ""
    c.faculty.forEach(function(el){
	out+=el.displayName+", and ";
    });
    return out ? out.substr(0, out.length-6) : "STAFF";
};
app.courseHere = function(day, hour, course){
    if (!course) return;
    var res = null;
    
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
app.convertTime = function(time){
    var minute = time.substr(-2);
    return parseFloat(time.substr(0, time.length-minute.length), 10)+parseFloat(minute)/60-8;
};

app.autoFilter = function(courses, referrer){ // remove all consecutive duplicates - only in automatic mode
    this.mode = referrer ? referrer.value : this.mode;
    return this.mode == "Manual" ? app.courses_manual : app.courses_auto;
};

app.fillSchedule = function(referrer) {
    if(referrer)
	this.course_list_selection = referrer.value;
    this.course = document.getElementById("selectBox").value != "" ? parseInt(document.getElementById("selectBox").value) : null;
    var wrappers = document.getElementsByClassName("wrapperInternal");
    var schedule = this.autoConstruct(this.selected.concat(app.courses[this.course])).get(this.mode == 'Manual' ? 0 : this.course_list_selection);
    // Then, cycle through and build a divlist
    var divTracker = [];
    for(var i=0; i < wrappers.length; ++i){
	var wrapper = wrappers[i];
	var day = wrapper.getAttribute("data-day");
	var hour = wrapper.getAttribute("data-hour");
	while(wrapper.firstChild) // clear
	    wrapper.removeChild(wrapper.firstChild);
	for(var j=0; j<schedule.length; ++j){
	    var course = schedule[j];
	    var courseHere = this.courseHere(day, hour, course);
	    if(course && courseHere){
		var div = document.createElement("div");
		div.className = "item";
		var creditText = this.creditsOf(course);
		var innerText = course.subject + ' ' + course.courseNumber + '\n' + course.courseTitle.replace(/&ndash;/g, "–") + '\n' + app.genFaculty(course) + '\n' + courseHere.loc + '\n' + creditText + ' credit' + (creditText !=1 ? 's' : '') + '\n' + Math.max(0, course.seatsAvailable) + '/' + course.maximumEnrollment + ' seats open\n';
		if(course.waitAvailable > 0)
		    innerText += course.waitAvailable + '/' + course.waitCapacity + ' waitlist open\n';
		innerText += 'CRN: ' + course.courseReferenceNumber + '\n';
		div.innerText = innerText; // need to assign all at once so newlines work properly
		var link = document.createElement("a");
		link.className = "link";
		link.onclick = function(c){ // we need to close this in, else it looks at the last
		    return function(){app.fetchDescription(c);}; // value of course to be updated
		}(course);
		link.innerText = "Description";
		div.appendChild(link)
		div.setAttribute("data-index", course.index);
		div.setAttribute("data-length", courseHere.length);
		div.setAttribute("data-top", courseHere.top);
		if(!app.autoInAlts(course, app.courses[app.course])) // run an update instantle - fixes flashes
		    div.classList.add("selected");
		div.style.top = div.getAttribute("data-top") * 100 + '%';
		div.style.height = app.hovering.includes(course) ? 'auto' : div.getAttribute("data-length") * 100 + '%';
		div.style.minHeight = !app.hovering.includes(course) ? 'auto' : div.getAttribute("data-length") * 100 + '%';
		wrapper.appendChild(div);
		divTracker.push(div);
	    }
	}
    }

    //WEB CLASSES
    var webWrapper = document.getElementById("webWrapper");
    var web = document.getElementById("web");
    while(web.firstChild)
	web.removeChild(web.firstChild);
    var schedule = this.autoConstruct(this.selected.concat(app.courses[this.course])).get(this.mode == 'Manual' ? 0 : this.course_list_selection);
    var webClasses = this.webclasses(schedule);
    webWrapper.style.display = webClasses.length ? "" : "none";
    for(var j=0; j<webClasses.length; ++j){
	var course = webClasses[j];
	if(course){
	    var div = document.createElement("div");
	    div.className = "item";
	    var creditText = this.creditsOf(course);
	    div.innerText = course.subject + ' ' + course.courseNumber + '\n' + course.courseTitle.replace(/&ndash;/g, "–") + '\n' + app.genFaculty(course) + '\n' + creditText + ' credit' + (creditText !=1 ? 's' : '') + '\n' + Math.max(0, course.seatsAvailable) + '/' + course.maximumEnrollment + ' seats open\n' + course.courseReferenceNumber + '\n';
	    var link = document.createElement("a");
	    link.className = "link";
	    link.onclick = function(c){ // we need to close this in, else it looks at the last
		return function(){app.fetchDescription(c);}; // value of course to be updated
	    }(course);
	    link.innerText = "Description";
	    div.appendChild(link)
	    div.setAttribute("data-index", course.index);
	    if(!app.autoInAlts(course, app.courses[app.course])) // run a single update instantly - fixes flashing in some cases
		div.classList.add("selected");
	    web.appendChild(div);
	    divTracker.push(div);
	}
    }

    //Set listeners
    var update = function(divs){
	return function(){
	    for(var k=0; k<divs.length; ++k){
		var div = divs[k];
		var course = app.courses[div.getAttribute("data-index")];
		if(!app.autoInAlts(course, app.courses[app.course]))
		    div.classList.add("selected");
		else
		    div.classList.remove("selected");
		if(app.hovering.includes(course))
		    div.classList.add("hovering");
		else
		    div.classList.remove("hovering");
		if(div.getAttribute("data-top")){ // non-web
		    div.style.top = div.getAttribute("data-top") * 100 + '%';
		    div.style.height = app.hovering.includes(course) ? 'auto' : div.getAttribute("data-length") * 100 + '%';
		    div.style.minHeight = !app.hovering.includes(course) ? 'auto' : div.getAttribute("data-length") * 100 + '%';
		}
	    }
	}
    }(divTracker);
    for(var j=0; j<divTracker.length; ++j){
	divTracker[j].ondblclick = function(course){
	    return function(){
		app.click(course);
		app.course = null;
		document.getElementById("selectBox").value = "";
	    }
	}(app.courses[divTracker[j].getAttribute("data-index")]);
	divTracker[j].onmouseenter = function(course){
	    return function(){
		app.hovering = app.autoAndLabs(course);
		update();
	    }
	}(app.courses[divTracker[j].getAttribute("data-index")]);
	divTracker[j].onmouseleave = function(){
	    return function(){
		app.hovering = [];
		update();
	    }
	}();
    }
    
    this.dayUpdate(); // and all the other stuff
    this.autoBar();
    this.saveMarker();
    this.updateCredits();

    //Deal with the "you can deselect" thing
    document.getElementById("escTip").style.display = this.course != null && (this.closed || app.courses[this.course].seatsAvailable) ? "" : "none";

    localStorage.setItem('lastViewed', this.generateHash(false));
    if(this.selected.length > 0)
	gtag('event', 'Schedules Tested');
};

app.fillSearch = function(referrer) {
    var selectBox = document.getElementById("selectBox");
    var val = selectBox.value;
    while(selectBox.lastChild.value != "")
	selectBox.removeChild(selectBox.lastChild);
    var courses = this.autoFilter(app.courses, referrer);
    for(var i = 0; i < courses.length; i++)
	selectBox.appendChild(courses[i]);
    selectBox.value = val;
    this.hideSearch();
};

app.hideSearch = function(referrer) {
    if(referrer){
	this.closed = referrer.checked;
	location.hash = app.generateHash(false); // update url for closed value
    }
    var options = document.getElementById("selectBox").children;
    var search = document.getElementById("searchBox").value.toLowerCase();
    for(var i=1; i < options.length; ++i)
	options[i].style.display = this.filterSearch(app.courses[options[i].value], search) ? "" : "none";
};

app.filterSearch = function(course, search) {
    if(this.selected.indexOf(course) !== -1) return false;
    if (!this.closed && !course.seatsAvailable) return false;
    
    if(search && !((course.subject + ' ' + course.courseNumber).toLowerCase().indexOf(search) > -1 ||
		   course.courseTitle.toLowerCase().indexOf(search) > -1)) // not found in search
	return false; // this is done first because it's faster than constructing alts list
    
    if(this.mode == "Automatic"){
	if(course.home.alts.reduce(function(acc_list, cur){ // look all of course alts
	    return acc_list.concat(cur); // where cur is a typePack
	}, []).some(alt => this.selected.includes(alt))) // and check if any overlap with selected
	    return false;
    }
    
    return true;
};

app.webclasses = function(courses)
{
    return courses ? courses.filter(function(course){
	return course && (course.meetingsFaculty.map(el => el.meetingTime.building == "ONLINE").reduce((a, b) => (a || b), false));
    }) : [];
};

window.addEventListener("keydown", function (e) { // remove app.course and re-render
    if(e.key == "Escape" || e.key == "Delete"){   // when deleted or escaped
	document.getElementById("selectBox").value = "";
	app.course = null;
	app.savedCourseGenerator = "";
	app.courses_generator = null; // force a recalculation to reflect change in app.course
	app.fillSchedule();
    }
})

app.fetchDescription = function(course) {
    document.getElementById("description-fetch").style.display = "";
    document.getElementById("description-show").style.display = "none";
    document.getElementById("description").style.display = "";
    document.getElementById("description-strong").innerText = course.subject + " " + course.courseNumber + ":";
    var updater = function(text){
	var show = document.getElementById("description-show");
	show.innerText = text;
	show.style.display = "";
	document.getElementById("description-fetch").style.display = "none";
    }
    if(!course.description){
	(new Searcher("desc", course.term.toString(), course.courseReferenceNumber.toString())).start(function(response){
	    updater(response);
	    course.description = response;
	});
    } else {
	updater(course.description);
    }
};


app.dayUpdate = function(){
    var test = false;
    if(this.mode == "Automatic"){
	if(app.courses_generator)
	    if(app.courses_generator.data){
		if(app.courses_generator.data[this.course_list_selection]){
		    test = app.courses_generator.data[this.course_list_selection].value;
		    document.getElementById("noSchedAlign").style.display = "none";
		    if(document.getElementById("schedTbody").children[0].children[1].style.display == "none"){
			for(var i=1; i<=5; ++i){
			    var trs = document.getElementById("schedTbody").children;
			    for(var j=0; j<trs.length; ++j){
				trs[j].children[i].style.display = "";
			    }
			}
		    }
		} else { // no valid schedules - show msg
		    document.getElementById("noSchedAlign").style.display = "";
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
    } else {
	test = this.selected.concat(app.courses[this.course]);
	document.getElementById("noSchedAlign").style.display = "none";
	if(document.getElementById("schedTbody").children[0].children[1].style.display == "none"){
	    for(var i=1; i<=5; ++i){
		var trs = document.getElementById("schedTbody").children;
		for(var j=0; j<trs.length; ++j){
		    trs[j].children[i].style.display = "";
		}
	    }
	}
    }
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
