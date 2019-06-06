2//ADD - if there's a saved schedule in another term, save that term's classes in session storage, and preload when available?
//ADD - notes that can be saved with schedules
//ADD - dark theme
//ADD - do something with refreshes on active plans?
//ADD - click-drag rearange saves

let test_percent_cap = 100; // takes a long time to load on 100%, consider 1% for testing
let chunk = 300; // 500 is the largest the server will honor, but fastest seems to be 300
//These values have been found from tested on my machine. Feel free to test yourself
//500---> Finish: 46.84s, 49.08s, 42.61s = 46.176s avg
//400---> Finish: 44.52s, 40.94s, 37.04s = 40.826s avg
//300---> Finish: 38.30s, 35.46s, 38.66s = 37.473s avg ***
//200---> Finish: 42.70s, 43.13s, 38.08s = 41.303s avg
//100---> Finish: 45.26s, 34.36s, 36.82s = 38.813s avg
var server = function(h) { return 'https://bannerxe.is.colostate.edu/StudentRegistrationSsb/ssb/' + h; };

function postProcessCourses(courses){ // post process in preparation for automatic mode
    return courses
	.filter(function(course){ // only deal with courses that can be shown on the board - will ask around about the "ghost courses" and why they are even there - example is MATH 369 "EX"
	    return course.meetingsFaculty.reduce(function(acc, cur){
		return acc||["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].reduce((_acc,_cur)=>_acc||cur.meetingTime[_cur], false);
	    }, false);
	})
	.map(function(course){ // fix honors vs non-honors courses
	    // this fixes a bug where autoConstruct would
            // assume we want both normal and Honors courses like strict co-reqs (similar to Labs and Recs)
	    if(course.scheduleTypeDescription.includes("Honors "))
		course.scheduleTypeDescription = course.scheduleTypeDescription.split("Honors ")[1];
	    return course;
	})
	.reduce(function(acc, cur){ // collect all courses into lists of same subjectCourse (ECE101)
	    if(acc.length > 0){ // this is done in case courses are stored in a weird order
		if(acc[acc.length-1][0].subjectCourse == cur.subjectCourse) // compare to previous packet
		    acc[acc.length-1].push(cur); // push to last packet where it's the same
		else
		    acc.push([cur]); // or set up a new packet
		return acc;
	    } else { // set up the first one
		return [[cur]];
	    }
	}, [])
	.map(function(packet){ // process each packet
	    //the processing goes as follows - one of each type of scheduleTypeDescription needs to be applied
	    //this can be one Lecture, one Lab, and one Recitation
	    //or, in cases like ECE 450, one lab (no Lectures)
	    //in more exotic cases, I'm really just waiting for edge cases to pop up ¯\_(ツ)_/¯
	    //alts show up in the form of alts:[typePacks:[courses...]...]
	    //automatic mode will only look at alts, and pick one from each type - won't look at main course
	    packet[0].home = packet[0];
	    packet[0].alts = [[packet[0]]]; // set up first one
	    for(var i=1; i<packet.length; ++i){ // start at the second one
		packet[i].home = packet[0]; // set the home - used for referencing alts
		var foundIndex = packet[0].alts.findIndex(typePack => typePack[0].scheduleTypeDescription == packet[i].scheduleTypeDescription);
		if(foundIndex > -1) // there exists a typePack in alts which has the same type as packet[i]
		    packet[0].alts[foundIndex].push(packet[i]); // add to revalent typePack
		else // the type of packet[i] is new to typePack
		    packet[0].alts.push([packet[i]]); // add as a new typePack
	    }
	    return packet;
	})
	.reduce(function(acc, cur){ // then unwrap packets into a big course list
	    return acc.concat(cur); // [prev...] + ...[packet contents] = [prev..., packet contents]
	}, [])
	.map(function(course, i){ // and add indices and fix scheduleTypeDescriptors
	    course.index = i;
	    return course;
	});
}

class Searcher{
    // A wrapper to perform a single XMLHttpRequest
    // Allows for stopping and starting of request
    constructor(type, term = null, offset = null, size = null){ // when offset == null or isn't provided, just prime
	this.term = term;
	this.data = [];
	this.done = false;
	this.offset = offset; // if type == desc, offset is interpreted as the course reference number
	this.size = size;
	this.xhr = null;
	this.type = type;
    }
    start(callback = null){
	if(this.xhr || this.done) // don't restart if not needed
	    return;
	var url = "";
	var sendData = null;
	var openMethod = "GET";
	switch(this.type){
	case "prime":
	    url = server("term/search?mode=search");
	    sendData = "term=" + this.term + "&studyPath=&studyPathText=&startDatepicker=&endDatepicker=";
	    openMethod = "POST";
	    break;
	case "courses":
	    url = server("searchResults/searchResults?txt_term=" + this.term + "&startDatepicker=&endDatepicker=&pageOffset=" + this.offset.toString() + "&pageMaxSize=" + this.size.toString() + "&sortColumn=subjectDescription&sortDirection=asc");
	    break;
	case "terms":
	    url = server("classSearch/getTerms?searchTerm=&offset=1&max=100&_=1554348528566");
	    break;
	case "desc":
	    url = server("searchResults/getCourseDescription");
	    sendData = "term=" + this.term + "&courseReferenceNumber=" + this.offset;
	    openMethod = "POST";
	    break;
	case "test":
	    url = server("");
	    break;
	default:
	    console.error("Invalid type in Searcher");
	}
	this.xhr = new XMLHttpRequest();
	this.xhr.onreadystatechange = function(ref){ // callback
	    return function(){
		if(ref.type == "test" && this.readyState === 4 && this.status === 0){ // test failed
		    console.log("CORS DENIED - please enable a CORS-everywhere extension or ask CSU to let us in");
		    if(callback)
			callback(false);
		    return;
		}
		if(ref.type == "test" && this.readyState === 4){ // test was successful
		    if(callback)
			callback(true);
		    return;
		}
		if(ref.type == "test")
		    return; // forget about everything else if it's just a test
		if (this.readyState === 4 && this.status === 200){
		    var response = ref.type == "desc" ? this.responseText.replace(/<br>/g, "\r\n").replace(/<BR>/g, "\r\n").trim() : JSON.parse(this.responseText);
		    if(ref.type != "prime") // else it's priming and just a post
			ref.data = response.data;
		    if(callback)
			callback(response);
		    ref.done = true;
		    ref.xhr = null;
		}
		else if(this.status != 200 && this.status != 0){
		    console.log("A network request failed with code " + this.status.toString()); // might need in the future for testing errors
		    this.xhr = null; // I DONT KNOW WHAT TO DO HERE YET
		}
	    }
	}(this);
	this.xhr.open(openMethod, url); // local sync
	this.xhr.withCredentials = true; // needed for auth cookies
	if(openMethod == "POST")
	    this.xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded'); // needed for submitting form data - posts and descriptions
	this.xhr.send(sendData);
    }
    stop(){
	if(!this.xhr || this.done) // can't stop what's not there to stop
	    return;
	this.xhr.abort();
	this.xhr = null;
    }
}

class TermManager{
    // A wrapper around many Searcher objects
    // Performs many XMLHttpRequests for an entire term
    // Allows for stopping, starting, and dynamic callbacks upon completion
    // Caches partially completed results
    constructor(term){
	this.term = term;
	this.data = [];
	this.done = false;
	this.requests = [];
	this.headRequest = null;
	this.main_callback_wrapper = {callback: null};
    }
    stop(){ // abort all requests and prime for a restart
	if(this.done) // why stop something that's already done?
	    return;
	this.main_callback_wrapper.callback = ()=>{};
	if(this.headRequest){
	    this.headRequest.stop();
	    this.headRequest = null; // in case we stopped during a head request
	}
	this.requests.forEach(function(request){
	    request.stop(); // stop each one
	});
    }
    start(main_callback, bypass = false){ // construct all requests and send, or if already constructed just send
	this.main_callback_wrapper.callback = main_callback;
	//main_callback is what to do after the term is done loading. It's like an await
	if(this.done){ // if it's already done, run the callback and exit
	    if(main_callback)
		main_callback(this.data);
	    return;
	}
	if(this.headRequest){ // already started, but not finished. Just need to change the main_callback
	    return; // don't bother re-starting
	}
	var callback = function(TermManager_ref){ // set up callback, actual execution is after definition
	    return function(ignored){ // this one is just needed to get cookies in line
		if(TermManager_ref.data.length){ // we've already made some requests - just finish them
		    var loadedAmount = TermManager_ref.data.reduce(function(acc, cur){ // check how many courses we have loaded so far
			return acc + cur.data.length; // by summing them all up
		    }, 0);
		    app.percent = loadedAmount.toString() + "/" + TermManager_ref.data[0].totalCount.toString();
		    app.updatePercent();
		    TermManager_ref.headRequest = null;
		    TermManager_ref.requests.forEach(function(request){
			request.start(function(responseData){ // individual callbacks
			    TermManager_ref.data.push(responseData); // add response to data...
			    // and check if we're done
			    var loadedAmount = TermManager_ref.data.reduce(function(acc, cur){ // check how many courses we have loaded
				return acc + cur.data.length; // by summing them all up
			    }, 0);
			    app.percent = loadedAmount.toString() + "/" + TermManager_ref.data[0].totalCount.toString();
			    app.updatePercent();
			    if(loadedAmount >= test_percent_cap*TermManager_ref.data[0].totalCount/100){ // and see if we've got enough
				app.percent += "\nProcessng courses...";
				app.updatePercent();
				// if so, process data and mark term complete
				TermManager_ref.data = postProcessCourses(
				    TermManager_ref.data // take fufilled requests
					.sort((a, b) => a.pageOffset - b.pageOffset) // sort them all, because they probably won't load in order
					.reduce(function(acc, cur){ // and unwrap them all
					    return acc.concat(cur.data); // into one big array
					}, [])
				); // then post process them so automatic mode actually works
				
				TermManager_ref.done = true;
				TermManager_ref.requests = []; // free up some memory
				if(TermManager_ref.main_callback_wrapper.callback) // it's weird because we can't close in the function, we need to make sure it can change
				    TermManager_ref.main_callback_wrapper.callback(TermManager_ref.data);
			    }
			});
		    });
		} else { // first time requesting - do a small request first, then fill up
		    app.percent = "0/?";
		    app.updatePercent();
		    TermManager_ref.headRequest = new Searcher("courses", TermManager_ref.term, 0, 10);
		    TermManager_ref.headRequest.start(function(responseData){
			TermManager_ref.headRequest = null; // head requests are all done
			TermManager_ref.data = [responseData]; // currently wrapped with extra info, will unwrap later
			var min = responseData.data.length; // how many actually loaded with the first request
			//NOTE: Yes, it's not always 10. The server seems to always honor larger requests (100+), but doesn't always give us the amount we ask for with smaller queries, so we have to check this
			var max = responseData.totalCount; // how many courses are in the database
			app.percent = min.toString() + "/" + max.toString();
			app.updatePercent();
			let offsets = []; // stores offset values for each subsequent required request
			for(var i = min; i<test_percent_cap*max/100; i+=chunk)//NOTE: previously was using test_percent_cap*(max-min)/100, but this seems more logical. If error arrises, it's probably from here
			    offsets.push(i); // fill offsets with integer values starting at min, offset by chunk size, and going up to only what we need to request
			offsets.forEach(function(offset){ // construct all subsequent requests
			    TermManager_ref.requests.push(new Searcher("courses", TermManager_ref.term, offset, chunk));
			});
			TermManager_ref.start(main_callback, true); // recurse into start. Now that requests is filled, it'll just start them all
		    });
		}
	    }
	}(this);
	
	if(bypass){ // recursing -- don't bother POSTing again
	    callback(null);
	} else { // not recursing -- POST and then run callback
	    this.headRequest = new Searcher("prime", this.term); // prime it
	    this.headRequest.start(callback);
	}
    }
}

class TermCacher{
    // A wrapper around many TermManagers
    // Caches results, complete and partial
    // Allows for callbacks on completion, which are ignored if a different term is pushed
    constructor(){
	this.termManagers = [];
    }
    push(term, callback=null){ // start loading a term
	//first, sift through termManagers and see if we've already got one loaded/loading
	var index = this.termManagers.findIndex(termManager => termManager.term == term);
	var activeManager = null;
	if(index > -1) // there's one in there
	    activeManager = this.termManagers.splice(index, 1)[0]; // remove the active manager
	this.termManagers.forEach(function(termManager){ // stop all the (other) ones
	    termManager.stop();
	})
	this.termManagers.push(index > -1 ? activeManager : new TermManager(term)); // re-add the old one
	this.termManagers[this.termManagers.length-1].start(callback); // and start it
	// doing it this way makes it so if there's already one in there, AND it's running, it isn't restarted
	// however, this does stop any pending requests, even if the one we're looking for is already loaded
    }
}

class Lazy{ // a semi-memoized simplified, and specialized version of the Lazy class you can find online
    constructor(inputgen){
        this.core = inputgen;
        this.data = [];
    	this.filters = [];
	this.done = false;
    }
    get(i, set=false){
        while(!this.done && (this.data.length <= i)){
	    var tmp = this.core.next();
	    if(tmp.done){
		this.done = true;
		break;
	    }
	    if(this.filters.reduce(function(acc, cur_filter){ // run all filters on value
		return acc && cur_filter(tmp.value);
	    }, true)){
		this.data.push({value: tmp.value, selected: tmp.value.filter(function(course){// => // cache selected change
		    return !course.home.alts.reduce(function(acc, cur){ // look through all of course offerings
			return acc.concat(cur); // where cur is a typePack
		    }, []).includes(app.courses[app.course]) // remove pending selection
		})}); // we need to do this here so it updates the url dynamically
            }
	}
	var data = this.data[i];
	if(!data)
	    return false; // no valid schedules
	if(set || this.data.length != 1) // set selected on either a click, or on a autobar change
	    app.selected = data.selected; // update selected on click
	location.hash = app.generateHash(); // update url
        return data.value;
    }
    filter(filter_fun){
	this.filters.push(filter_fun);
	return this;
    }
}

window.addEventListener("keydown", function (e) { // remove app.course and re-render
    if(e.key == "Escape" || e.key == "Delete"){   // when deleted or escaped
	document.getElementById("selectBox").value = "";
	app.course = null;
	app.savedCourseGenerator = "";
	app.courses_generator = null; // force a recalculation to reflect change in app.course
	app.fillSchedule();
    }
})

var app = 
    {
	courses: [],
	courses_generator: null,
	termCacher: new TermCacher(),
	mode: "Manual",
        hovering: [],
        currentstorage: null,
        localStorage: [],
        terms: [],
        term: "",
        courses: [],
	courses_auto: [],
	courses_manual: [],
        course: null,
	courses_list: [],
	course_list_selection: 0,
	savedCourseGenerator: "0",
        selected: [],
        closed: false,
	loading: false,
	percent: "",
        safari: navigator.userAgent.indexOf('Safari') != -1 && navigator.userAgent.indexOf('Chrome') == -1,
	mounted: function()
	{
	    document.getElementById("noSchedAlign").style.display = "none";
	    //check CORS
	    (new Searcher("test")).start(function(success){
		if(success){
		    document.getElementById("loading").style.display = "none";
		    document.getElementById("main").style.display = "";
		} else {
		    document.getElementById("loading").style.display = "none";
		    document.getElementById("cors").style.display = "";
		}
	    });
	    (new Searcher("terms")).start(function(response){
		app.terms = response;
		if (app.hashExists() && (index = app.terms.map(el => el.code).indexOf(location.hash.split("=")[0].substr(1))) > -1){ //need to load from url
		    app.term = app.terms[index].code;
		    app.updateTerms();
		    app.changedTerm(true);
		} else {
		    app.term = app.terms[0].code;
		    app.updateTerms();
		    app.changedTerm(false);
		}
		document.getElementById("termSelect").value = app.term;
		if(localStorage.schedules)
		    app.localStorage = JSON.parse(localStorage.schedules);
		app.updateSaved();
	    });


	    // set up genNext / loop button longpress controls
	    var button = document.querySelector("#nextButton");
	    // Listening for the mouse and touch events    
	    button.addEventListener("mousedown", pressingDown, false);
	    button.addEventListener("mouseup", notPressingDown, false);
	    button.addEventListener("mouseleave", notPressingDown, false);
	    
	    button.addEventListener("touchstart", pressingDown, false);
	    button.addEventListener("touchend", notPressingDown, false);

	    var waiter = null;
	    function pressingDown(e) {
		app.genNext(button);
		waiter = setTimeout(doSomething, 750);
	    }
	    
	    function notPressingDown(e) {
		clearTimeout(waiter);
		waiter = null;
	    }
	    
	    function doSomething(e) {
		app.genNext(button);
		waiter = setTimeout(doSomething, 50);
	    }
	},
	totalCredits: function(){
	    return this.selected.reduce(function(acc, cur){
		return acc+app.creditsOf(cur);
	    }, 0);
	},
	creditsOf: function(course){
	    if(course.creditHours != undefined)
		return course.creditHours;
	    if(course.creditHourLow != undefined)
		return course.creditHourLow;
	    return course.creditHourHigh;
	},
	fillSchedule: function(referrer) {
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
			div.innerText = course.subject + ' ' + course.courseNumber + '\n' + course.courseTitle.replace(/&ndash;/g, "–") + '\n' + app.genFaculty(course) + '\n' + courseHere.loc + '\n' + creditText + ' credit' + (creditText !=1 ? 's' : '') + '\n' + Math.max(0, course.seatsAvailable) + '/' + course.maximumEnrollment + ' seats open\n' + course.courseReferenceNumber + '\n';
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
	},
	fillSearch: function(referrer) {
	    var selectBox = document.getElementById("selectBox");
	    var val = selectBox.value;
	    while(selectBox.lastChild.value != "")
		selectBox.removeChild(selectBox.lastChild);
	    var courses = this.autoFilter(app.courses, referrer);
	    for(var i = 0; i < courses.length; i++)
		selectBox.appendChild(courses[i]);
	    selectBox.value = val;
	    this.hideSearch();
	},
	hideSearch: function(referrer) {
	    if(referrer){
		this.closed = referrer.checked;
		location.hash = app.generateHash(); // update url for closed value
	    }
	    var options = document.getElementById("selectBox").children;
	    var search = document.getElementById("searchBox").value.toLowerCase();
	    for(var i=1; i < options.length; ++i)
		options[i].style.display = this.filterSearch(app.courses[options[i].value], search) ? "" : "none";
	},
        filterSearch: function(course, search) {
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
        },
        fetchDescription: function(course) {
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
        },
	autoFilter: function(courses, referrer){ // remove all consecutive duplicates - only in automatic mode
	    this.mode = referrer ? referrer.value : this.mode;
	    return this.mode == "Manual" ? app.courses_manual : app.courses_auto;
	},
	// check if check_course exists within the alts of course_alts, but ONLY if we're in automatic mode
	autoInAlts: function(check_course, course_alts){ // pretty much just fixes a render bug
	    if(check_course == null || course_alts == null)
		return false; // if there's one or zero, we don't even need to check
	    if(this.mode == "Manual")
		return check_course == course_alts;
	    return check_course.home == course_alts.home; // automatic - if check_course is course_alts or is in its alts
	},
	// grab the course, and pair it with any labs (and recs, etc). Determines hover style in auto
	autoAndLabs: function(check_course){
	    if(check_course == null)
		return []; // if there's one or zero, we don't even need to check
	    if(this.mode == "Manual")
		return [check_course]; // Manual mode - only hover on one section
	    return app.courses_generator ? app.courses_generator.get(this.course_list_selection).filter(course => course && course.home == check_course.home) : [];
	},
	// return a Lazy object which spits out valid schedules, and cache it so that Vue templating doesnt calculate it a million times
	autoConstruct: function(courses){
	    if(courses[0] === undefined) return {get: function(i){return []}}; // no courses - go no further
	    if(courses.slice(-1)[0] === undefined) // remove empty at end when no class is selected
		courses.pop();
	    courses = courses.filter(course => course.seatsAvailable || app.closed);
	    if(this.mode == "Manual"){
		if("M"+courses.map(course => course.courseReferenceNumber).join() == this.savedCourseGenerator)
		    return app.courses_generator; // don't have to run the calculation for every hour in every day
		if(this.savedCourseGenerator[0] == "A" && this.course){ // switching from automatic to manual - update app.course
		    if(app.courses_generator)
			if(app.courses_generator.get(this.course_list_selection))
			    courses = app.courses_generator.get(this.course_list_selection); // slight optimization for caching
		    this.course = courses.filter(function(course){
			return course.home == app.courses[app.course].home;
		    })[0].index; // replace app.course with the proper one automatically assigned
		    document.getElementById("selectBox").value = this.course.toString();
		    //and fix a render bug
		}
		this.savedCourseGenerator = "M"+courses.map(el => el.courseReferenceNumber).join();
		app.courses_generator = {get: function(i){return courses;}};
		return app.courses_generator;
	    }
	    //automatic generator
	    if("A"+this.removeDuplicatesBy(course => course.home, courses).map(el => el.home.courseReferenceNumber).filter(c => c).join() + (this.closed ? "C" : "") == this.savedCourseGenerator)
		return app.courses_generator; // don't have to run the calculation for every hour in every day
	    if(this.savedCourseGenerator[0] == "M" && this.course){ // switching from manual to automatic - update app.course
		this.course = app.courses[this.course].home.index; // basically just a render bug
		document.getElementById("selectBox").value = this.course.toString();
	    }
	    this.course_list_selection = 0; // Reset on each new sched gen
	    var range = document.getElementById('Range');
	    range.max = 0;
	    range.value = 0; // and reset render
	    app.courses_generator = new Lazy(this.cartesianProduct(this.removeDuplicatesBy(course => course.home, courses).reduce(function(acc, course){ // expands courses into all alt lists
		course.home.alts.forEach(function(typePack){ // move in every typePack
		    //first, we need to check if we need to move any courses to the front of their typePack
		    //this makes auto<->manual switches behave as expected
		    courses.forEach(function(compareCourse){
			if(typePack.includes(compareCourse)){
			    typePack = typePack.filter(c => c!=compareCourse); // remove course
			    typePack.unshift(compareCourse); // then re-add it to front
			}	
		    })
		    acc.push(typePack);
		});
		return acc;
	    }, []))).filter(function(schedule){
		return !schedule.filter(course => !course.seatsAvailable && !app.closed).length;
	    }).filter(this.schedCompat);
	    this.savedCourseGenerator = "A"+this.removeDuplicatesBy(course => course.home, courses).map(el => el.home.courseReferenceNumber).filter(c => c).join() + (this.closed ? "C" : "");
	    return app.courses_generator;
	},
	removeDuplicatesBy: function(keyFn, array) {
	    var mySet = new Set();
	    return array.filter(function(x) {
		var key = keyFn(x), isNew = !mySet.has(key);
		if (isNew) mySet.add(key);
		return isNew;
	    });
	},
	//Generate the next valid schedule and apply it to the board, if possible
	genNext: function(button){
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
	},
	//Generates a Cartesian Product with given dimensions
	//Example: [['a', 'b'], ['c', 'd']] => [['a', 'c'],['a', 'd'],['b', 'c'],['b', 'd']]
	cartesianProduct: function*(dimensions){
	    if(dimensions.length <= 1){// no need to calculate for 1 length lists (0 neither) - just yield each schedule
		for(var i = 0; i<dimensions[0].length; ++i)
		    yield [dimensions[0][i]]; // wrap each course as its own schedule
		return; // generators are weird
	    }
	    var stack = new Array(dimensions.length).fill(0, 0, dimensions.length);
	    while(true){ // This incriments over stack, treating it like a mixed-base number
		for(var i = 0; i<stack.length-1; ++i){ // check stack state for carry
		    if(stack[i] > dimensions[i].length-1){
			stack[i] = 0; // carry to next stack address
			stack[i+1]++;
		    }
		}
                if(stack[stack.length-1] > dimensions[dimensions.length-1].length-1) // if the last one needs carry...
		    return; // all done
		var schedule = new Array(dimensions.length-1);
		for(var i=0; i<dimensions.length; ++i) // map stack address values to dimension address values
		    schedule[i] = dimensions[i][stack[i]];
		perm = schedule
		yield schedule;
		stack[0]++; // incriment stack
	    }
        },
	// check if a schedule in the form of sched:[course...] has no conflicts
	schedCompat: function(sched){
	    if(sched.length == 1)
		return true; // if there's one class, it's automatically valid
	    var backStack = [sched[0]]; // create a stack full of courses to check each new course against
	    var schedComp = 1;
	    while(schedComp < sched.length){ // go until sched is empty
		for(var i = 0; i<backStack.length; ++i)
		    if(!this.courseCompat(backStack[i], sched[schedComp])) // check all of backStack against the last course in sched
			return false; // if any are incompatable, the whole schedule is incompatable
		backStack.push(sched[schedComp++]); // move the one we just checked against backStack into backStack to check against everything else
	    } // we can't just pop because references
	    return true; // if none are incompatable, then the schedule is valid
	},
	// expand courses into meeting times and check validity
	// this is needed because some courses have multiple meeting times
	courseCompat: function(a, b){
	    return a.meetingsFaculty.reduce(function(a_compat, a_meeting){ // check every meeting in a...
		return a_compat && b.meetingsFaculty.reduce(function(b_compat, b_meeting){ // against every meeting in b
		    return b_compat && app.meetingCompat(a_meeting.meetingTime, b_meeting.meetingTime);
		}, true); // so if every meeting in b is compatable with...
	    }, true); // every meeting in a, return true else return false
	},
	// Check if two meetings are compatable
	meetingCompat: function(a, b){
	    if(!["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].reduce(function(acc, day){ // check if any of the days overlap
		return acc || (a[day] && b[day]); // and carry over any trues
	    }, false))
		return true; // if the two aren't even on the same days, we knot it's compatable
	    return !( (a.beginTime >= b.beginTime && a.beginTime <  b.endTime)|| // beginning time of a is within b
		      (a.endTime   >  b.beginTime && a.endTime   <= b.endTime)|| // end       time of a is within b
		      (b.endTime   >  a.beginTime && b.endTime   <= a.endTime)|| // beginning time of b is within a
		      (b.endTime   >  a.beginTime && b.endTime   <= a.endTime) ) // end       time of b is within a
	},
        getHash: function() {
	    return location.hash;
        },
	updateCredits: function() {
	    document.getElementById("credits").innerText = this.totalCredits();
	},
	saveMarker: function() {
	    document.getElementById("marker-save").style.display = this.changed() && this.selected.length ? "" : "none";
	    document.getElementById("marker-discard").style.display = this.changed() && this.currentstorage && this.selected.length ? "" : "none";
	    document.getElementById("marker-saveAsNew").style.display = this.currentstorage ? "" : "none";
	    document.getElementById("marker-delete").style.display = this.currentstorage ? "" : "none";
	    document.getElementById("marker-export").style.display = this.selected.length ? "" : "none";
	    document.getElementById("marker-new").style.display = this.selected.length ? "" : "none";
	},
	updateSaved: function() {
	    if(!this.localStorage)
		return;
	    var schedules = Object.keys(app.localStorage);
	    var saves = document.getElementById("saves");
	    for(var i=0; i<saves.children.length; ++i){
		var save = saves.children[i];
		var index = schedules.findIndex(el => el == save.innerText);
		if(index == -1){ // need to remove
		    saves.removeChild(save); // remove child
		    --i; // and step back into it's index
		} else {
		    schedules.splice(index, 1); // track the ones we've already found
		}
	    }
	    for(var i=0; i<schedules.length; ++i){
		var div = document.createElement("div");
		div.className = "option";
		div.innerText = schedules[i];
		saves.appendChild(div);
	    }
	    var options = saves.children;
	    for(var i = 0; i<options.length; ++i)
		options[i].onclick = function(reference){
		    return function(){ // force update
			var wrapper = reference.parentElement; // because changed() looks at style
			for(var i = 0; i < wrapper.children.length; ++i) // we need to do this twice in case load gets interrupted
			    wrapper.children[i].classList.remove("preselect");
			reference.classList.add("preselect");
			var success = app.load(reference.innerText); // we need to update look after
			for(var i = 0; i < wrapper.children.length; ++i)
			    wrapper.children[i].classList.remove("preselect");
			if(!success)
			    return; // if user declines, forget about it
			for(var i = 0; i < wrapper.children.length; ++i)
			    wrapper.children[i].classList.remove("selected");
			reference.classList.add("selected");
		    }
		}(options[i]);
	    for(var i=0; i<options.length; ++i){
		var option = options[i];
		if(app.currentstorage == option.innerText)
		    option.classList.add("selected");
		else
		    option.classList.remove("selected");
	    }
	    this.saveMarker();
	},
        save: function() {
	    if(!this.currentstorage) {
                var name = window.prompt("Please enter a name for the schedule");
                if(!name) return;
                this.currentstorage = name;
	    }
	    
	    if(!localStorage.schedules) localStorage.setItem('schedules', JSON.stringify({}));
	    var schedules = JSON.parse(localStorage.schedules);
	    schedules[this.currentstorage] = this.generateHash();
	    localStorage.setItem('schedules', JSON.stringify(schedules));
	    this.localStorage = schedules;
	    this.updateSaved();
        },
        load: function(schedule) {
	    if(this.changed())
                if (!window.confirm("Are you sure you want to discard your changes?"))
		    return false;
	    this.currentstorage = schedule;
	    location.hash = this.localStorage[schedule];
	    var currentTerm = location.hash.split("=")[0].substr(1);
	    if ((index = this.terms.map(term => term.code).indexOf(currentTerm)) > -1){ // if term is valid
                if(this.term != this.terms[index].code) {
		    this.term = this.terms[index].code;
		    this.updateTerms();
		    this.changedTerm(true);
                } else {
		    this.course = null;
		    document.getElementById("selectBox").value = "";
		    this.updateTerms();
		    this.loadHash();
                }
	    }
	    this.fillSchedule();
	    return true;
        },
        discard: function() {
	    if(this.changed())
		if (!window.confirm("Are you sure you want to discard your changes?"))
		    return;
	    var schedule = this.currentstorage;
	    this.currentstorage = null;
	    this.load(schedule);
        },
        saveNew: function() {

	    this.currentstorage = null;
	    this.save();
        },
        deleteSchedule: function() {
	    if (window.confirm("Are you sure you want to delete the schedule " + this.currentstorage + "?")) {
                var schedules = JSON.parse(localStorage.schedules);
                delete schedules[this.currentstorage];
                localStorage.setItem('schedules', JSON.stringify(schedules));
                this.localStorage = schedules;
                this.clear(true);
		this.updateSaved();
		this.fillSchedule();
	    }
        },
        clear: function(bypass = false) {
	    if(!bypass && this.changed())
                if (!window.confirm("Are you sure you want to discard your changes?"))
		    return false;
	    document.getElementById("selectBox").value = "";
	    this.course_list_selection = 0;
	    var range = document.getElementById('Range');
	    range.max = 0;
	    range.value = 0;
	    app.courses_generator = null;
	    this.savedCourseGenerator = "";
	    location.hash = "";
	    this.course = null;
	    this.selected = [];
	    this.currentstorage = null;
	    this.updateSaved();
	    this.fillSchedule();
	    this.hideSearch();
	    return true;
        },
        webclasses: function(courses)
        {
	    return courses ? courses.filter(function(course){
		return course && (course.meetingsFaculty.map(el => el.meetingTime.building == "ONLINE").reduce((a, b) => (a || b), false));
	    }) : [];
        },
	showExport: function(){
	    document.getElementById("export").style.display = "";
	    document.getElementById("export-link").value = location.href;
	    document.getElementById("export-text").value = this.selected.map(function(c) { return c.courseReferenceNumber + ': ' + c.subject + ' ' + c.courseNumber }).join('\n');
	},
        changedTerm: function(loadHash = false, referrer = null)
        {
	    if(!loadHash && referrer && this.changed())
                if (!window.confirm("Are you sure you want to discard your changes?")){
		    document.getElementById("termSelect").value = this.term;
		    return false;
		}
	    if(this.currentstorage && loadHash !== true)
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
	    this.fillSchedule(); // show empty while loading
	    this.percent = "";

	    document.getElementById("coursesBox").style.display = "none";
	    document.getElementById("loadingCourses").style.display = "";
	    app.termCacher.push(this.term, function(_loadHash){ // NOTE: not sure if this needs a closure
		return function(courses){
		    app.courses = courses;
		    app.genDivs();
		    if(_loadHash)
			app.loadHash();
		    app.fillSchedule();
		    app.fillSearch();
		}
	    }(loadHash));
	},
	genDivs: function(loadSelect = true){
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
	    /*
	      var saves = document.getElementById("saves");
	      for(var i=0; i<saves.children.length; ++i)
	      if(saves.children[i].classList.contains("preselect"))
	      app.load(saves.children[i].innerText); // in case there are courses rendered that need to be hidde*/
	    document.getElementById("coursesBox").style.display = "";
	    document.getElementById("loadingCourses").style.display = "none";
	},
	updateTerms: function(){
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
	},
	changed: function(){
	    if(!this.selected.length)
		return false;
	    var saves = document.getElementById("saves").children;
	    var ret = true;
	    var foundIdx = -1; // this has to be done manually because Dom Collections don't have it
	    for(var i=0; i < saves.length; ++i)
		if(saves[i].classList.contains("selected")) // this will be BEFORE render change
		    foundIdx = i;
	    if(foundIdx > -1)
		ret = this.localStorage[saves[foundIdx].innerText] != this.generateHash();
	    //save coming from, vs actual classes on the board
	    else // edge case - if we're coming from no save selected and it happens to be the same
		for(var i=0; i < saves.length; ++i)
		    if(saves[i].classList.contains("preselect")) // this will be AFTER render change
			ret = this.localStorage[saves[i].innerText] != this.generateHash();
	    return ret;
	},
	loadHash: function(){ // loading from URL or save, get hash and parse it
	    var hashes = location.hash.split("=")[1].split("&")[0].split(",");
	    this.selected = app.courses.filter(function(course){
		return hashes.indexOf(course.courseReferenceNumber.toString()) > -1;
	    });
	    document.getElementById("closedCheck").checked = !!location.hash.split("&")[1];
	    this.closed = !!location.hash.split("&")[1];
	},
	genFaculty: function(c)
	{
	    let out = ""
	    c.faculty.forEach(function(el){
		out+=el.displayName+", and ";
	    });
	    return out ? out.substr(0, out.length-6) : "STAFF";
	},
        courseHere: function(day, hour, course){
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
        },
        convertTime: function(time)
        {
	    var minute = time.substr(-2);
	    return parseFloat(time.substr(0, time.length-minute.length), 10)+parseFloat(minute)/60-8;
	},
        click: function(course){
	    if (this.autoInAlts(app.courses[this.course], course)) // needs to be added to selected
	    {
		this.course = null;
		document.getElementById("selectBox").value = "";
		this.selected.push(course);
		if(this.mode == "Automatic"){
		    this.savedCourseGenerator = "A";
		    this.autoConstruct(this.selected).get(this.course_list_selection, true); // force url update & selected update
		}
	    }
	    else
	    {
		if(this.mode == "Manual")
		    this.selected.splice(this.selected.indexOf(course), 1);
		else
		    this.selected = this.selected.filter(c => course.subjectCourse != c.subjectCourse);
                this.hovering = [];
	    }

	    location.hash = this.generateHash();
	    this.course_list_selection = 0;
	    var range = document.getElementById('Range');
	    range.max = 0;
	    range.value = 0; // fix render on auto bar
	    this.hideSearch(); // TODO: optimize
	    this.fillSchedule();
        },
        hashExists: function(){
	    return location.hash.match(/#\d+=[\d+,?]+/);
        },
        generateHash: function() {
	    var hash = this.term + "=";
	    hash += this.selected.map(function(s){
		return s.courseReferenceNumber;
	    }).sort((a, b) => parseInt(a)-parseInt(b)).join();
	    if(this.closed)
		hash += "&C";
	    return hash;
        },
	autoBar: function(){
	    var autoBar = document.getElementById("autoBar");
	    autoBar.style.display = this.mode == 'Automatic' && this.selected.concat(app.courses[this.course])[0] != null ? "inline-block" : "none";
	    document.getElementById('nextButton').innerText='Next';
	},
	updatePercent: function(){
	    document.getElementById("loadingCourses").innerText = "Loading Courses... " + this.percent;
	},
	dayUpdate: function(){
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
    };

app.mounted();
