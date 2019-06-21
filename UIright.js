//Generate the next valid schedule and apply it to the board, if possible


app.totalCredits = function(){
    return this.selected.reduce(function(acc, cur){
	return acc+app.creditsOf(cur);
    }, 0);
};

app.genNext = function(button){
    if(app.courses_generator && app.courses_generator.get(app.courses_generator.data ? app.courses_generator.data.length : 0)){ // see if there's more we haven't seen yet
	this.course_list_selection = (app.courses_generator.data ? app.courses_generator.data.length : 0)-1; // and show it to us
    } else { // done - start looping
	this.course_list_selection++;
	this.course_list_selection%=(app.courses_generator ? app.courses_generator.data.length : 0);
    }
    this.fillSchedule();
    var range = document.getElementById("Range");
    range.max = app.courses_generator ? app.courses_generator.data.length-1 : 0;
    range.value = this.course_list_selection;

    button.innerText = (app.courses_generator ? app.courses_generator.done : false) ? "Loop" : "Next";
};

app.updateCredits = function() {
    document.getElementById("credits").innerText = this.totalCredits();
};


app.changedTerm = function(loadHash = false, referrer = null){
    if(!loadHash && referrer && this.changed())
        if (!window.confirm("Are you sure you want to discard your changes?")){
	    document.getElementById("termSelect").value = this.term;
	    return false;
	}
    if(this.currentstorage && loadHash != true)
	if(!this.clear()){ // user declined - fix selection box then return
	    document.getElementById("termSelect").value = this.term;
	    return;
	}
    if(referrer){
	if(referrer.firstChild.value == "") // clean up on first get
	    referrer.removeChild(referrer.firstChild);
	this.term = referrer.value;
    }
    if(!this.term)
	return; // empty
    this.course = null;
    document.getElementById("selectBox").value = "";
    document.getElementById("searchBox").value = "";
    this.selected = [];
    this.course_list_selection = 0;
    var range = document.getElementById('Range');
    range.max = 0;
    range.value = 0;
    app.courses_generator = null;
    this.savedCourseGenerator = "";
    if(loadHash != "first")
	this.fillSchedule(); // show empty while loading - don't need to on first load because it's already empty
    this.percent = "";

    document.getElementById("coursesBox").style.display = "none";
    document.getElementById("loadingCourses").style.display = "";
    //request new term to be loaded, and on success update UI
    app.termCacher.push(this.term, function(_loadHash){
	return function(courses){
	    // update UI
	    app.updateNotes(document.getElementById("notes")); // fix style in case notes have been cached
	    app.courses = courses;
	    app.genDivs();
	    if(_loadHash)
		app.loadHash(_loadHash === "first");
	    app.fillSchedule();
	    app.fillSearch();
	}
    }(loadHash));
};
app.genDivs = function(loadSelect = true){
    var courses_auto = app.courses.reduce(function(acc, cur){
	if(acc.length > 0){
	    if(cur.subjectCourse != acc[acc.length-1].subjectCourse){
		return acc.concat(cur); // add new
	    } else {
		return acc; // ignore duplicate
	    }
	} else {
	    return [cur]; // first iteration - set up accumulator
	}
    }, []);
    app.courses_manual = [];
    for(var i = 0; i < app.courses.length; i++){
	var c = app.courses[i];
	var el = document.createElement("option");
	el.textContent = c.subject + ' ' + c.courseNumber + ': ' + c.courseTitle;
	el.value = c.index;
	app.courses_manual.push(el);
    }
    app.courses_auto = [];
    for(var i = 0; i < courses_auto.length; i++){
	var c = courses_auto[i];
	var el = document.createElement("option");
	el.textContent = c.subject + ' ' + c.courseNumber + ': ' + c.courseTitle;
	el.value = c.index;
	app.courses_auto.push(el);
    }
    document.getElementById("coursesBox").style.display = "";
    document.getElementById("loadingCourses").style.display = "none";
};
app.updateTerms = function(){
    var selectBox = document.getElementById("termSelect");
    while(selectBox.lastChild)
	selectBox.removeChild(selectBox.lastChild);
    for(var i = 0; i < this.terms.length; i++){
	var term = this.terms[i];
	var option = document.createElement("option");
	option.value = term.code;
	option.innerText = term.description;
	selectBox.appendChild(option);
    }
    selectBox.value = this.term;
};


app.autoBar = function(){
    var autoBar = document.getElementById("autoBar");
    autoBar.style.display = this.mode == 'Automatic' && this.selected.concat(app.courses[this.course])[0] != null ? "inline-block" : "none";
    document.getElementById('nextButton').innerText='Next';
};
app.updatePercent = function(){
    document.getElementById("loadingCourses").innerText = "Loading Courses... " + this.percent;
};
app.updateNotes = function(noteBox){
    noteBox.style.height='25px';
    noteBox.style.height=(noteBox.scrollHeight+25)+'px';
    this.saveMarker();
};

app.loadHash = function(first){ // loading from URL or save, get hash and parse it
    var hashes = location.hash.split("=")[1].split("&")[0].split(",");
    this.selected = app.courses.filter(function(course){
	return hashes.indexOf(course.courseReferenceNumber.toString()) > -1;
    });
    document.getElementById("closedCheck").checked = !!location.hash.split("&")[1];
    this.closed = !!location.hash.split("&")[1];
    if(first){ // loading hash from URL - check if there's a save which matches, and if so select it
	// this will choose the firstmost schedule that matches
	var possible = [];
	for(var i=0,saves = document.getElementById("saves").children; i < saves.length; ++i)
	    if(this.localStorage[saves[i].innerText].split("+")[0] == location.hash.split("#")[1])
		possible.push(saves[i]);
	var lastMatch = possible.filter(function(element){ // sees if there's any save that was also most recently used
	    return app.localStorage[element.innerText].split("+")[0] + "!" + element.innerText == localStorage.lastSaved;
	});
	if(!possible.length){ // no matches - probably completly new
	    if((location.hash.split("&")[0].split("=")[1].length > 0) && (this.generateHash(false) != localStorage["lastViewed"])) // make sure there are actually some courses
		gtag('event', 'Schedules Shared'); // is completly new
	} else { // previous - load and update
	    (lastMatch.length ? lastMatch[0] : possible[0]).classList.add("selected"); // if we're reloading, go for the known correct schedule. Else, go for the first one to match
	    app.currentstorage = (lastMatch.length ? lastMatch[0] : possible[0]).innerText;
	}
    }
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


