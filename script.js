//ADD - CORS NOTI
//ADD - if there's a saved schedule in another term, save that term's classes in session storage, and preload when available?
//ADD - session cache course loading
//ADD - hold next button to fast generate courses
//ADD - loading 0/xxx
//BUG - Fall 2018 - ECE 450 - dupe lab
//BUG - If change term while loading - abandon
//ADD - older terms

let test_percent_cap = 100; // takes a long time to load on 100%, consider 1% for testing
let chunk = 300; // 500 is the largest the server will honor, but fastest seems to be 300
//These values have been found from tested on my machine. Feel free to test yourself
//500---> Finish: 46.84s, 49.08s, 42.61s = 46.176s avg
//400---> Finish: 44.52s, 40.94s, 37.04s = 40.826s avg
//300---> Finish: 38.30s, 35.46s, 38.66s = 37.473s avg ***
//200---> Finish: 42.70s, 43.13s, 38.08s = 41.303s avg
//100---> Finish: 45.26s, 34.36s, 36.82s = 38.813s avg
Vue.use(VueResource);
var server_cx = function(h) { return 'https://bannerxe.is.colostate.edu/StudentRegistrationSsb/ssb/' + h; };

let xhrzip = function(method, url, data, onstate){
    let xhr = new XMLHttpRequest(); // we need a new one every time in case we're doing async requests
    xhr.onreadystatechange = function(){ // callback
	if (this.readyState === 4 && this.status === 200)
	    ({responseText: this.responseText, core: onstate}).core(); // this just makes callback look and feel like normal, but always checks for readyness - mostly a convienence thing
	if(this.status != 200 && this.status != 0)
	    console.log("A network request failed with code " + this.status.toString()); // might need in the future for testing errors
    };
    xhr.open(method, url);
    xhr.withCredentials = true; // needed for auth cookies
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded'); // needed for submitting form data
    xhr.send(data);
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
		    return !course.home.alts.concat(course.home).includes(app.courses[app.course]) // remove pending
		}
		)}); // we need to do this here so it updates the url dynamically
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


var app = new Vue(
    {
	el: '#app',
	data:
	{
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
	    courses_generator: null,
            selected: [],
            search: "",
            closed: false,
            changed: false,
            justLoaded: true,
            showExport: false,
            description: false,
	    percent: "",
	    cache: [],
            safari: navigator.userAgent.indexOf('Safari') != -1 && navigator.userAgent.indexOf('Chrome') == -1
	},
	mounted: function()
	{
            this.$el.style.display = 'block';
	    document.getElementById("noSchedAlign").style.display = "none";
	    xhrzip("GET", server_cx("classSearch/getTerms?searchTerm=&offset=1&max=10&_=1554348528566"), null, function() {
		let response = JSON.parse(this.responseText);
		app.terms = response;
		if (app.hashExists() && (index = app.terms.map(el => el.code).indexOf(location.hash.slice(1, 7))) > -1)
		{
		    app.term = app.terms[index];
		}
		else
		{
		    app.term = app.terms[0];
		}
		app.changedTerm(true);
		if(localStorage.schedules) app.localStorage = JSON.parse(localStorage.schedules);
		app.updateSaved();
	    });
	},
	computed:
	{
            totalCredits: function()
            {
		return this.selected.map(function(c){
		    return (c.scheduleTypeDescription == "Laboratory" || c.scheduleTypeDescription == "Recitation") ? 0 : c.creditHours ? c.creditHours : c.creditHourLow ? c.creditHourLow : c.creditHourHigh ? c.creditHourHigh : 0;
		}).concat(0).reduce(function(a, b){
		    return a + b;
		});
            },
	},
	methods:
	{
	    fillSchedule: function(referrer) {
		if(referrer)
		    this.course_list_selection = referrer.value;
		this.course = document.getElementById("selectBox").value != "" ? parseInt(document.getElementById("selectBox").value) : null;
		var wrappers = document.getElementsByClassName("wrapperInternal");
		var schedule = this.autoConstruct(this.selected.concat(this.courses[this.course])).get(this.mode == 'Manual' ? 0 : this.course_list_selection);
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
			    var creditText = ((course.scheduleTypeDescription == "Laboratory" || course.scheduleTypeDescription == "Recitation") ? 0 : course.creditHours ? course.creditHours : course.creditHourLow ? (course.creditHourHigh ? course.creditHourLow.toString() + '-' + course.creditHourHigh.toString() : course.creditHourLow) : course.creditHourHigh ? course.creditHourHigh : 0);
			    div.innerText = course.subject + ' ' + course.courseNumber + '\n' + course.courseTitle.replace(/&ndash;/g, "–") + '\n' + app.genFaculty(course) + '\n' + courseHere.loc + '\n' + creditText + ' credit' + (creditText !=1 ? 's' : '') + '\n' + Math.max(0, course.seatsAvailable) + '/' + course.maximumEnrollment + ' seats open\n' + course.courseReferenceNumber + '\n';
			    var link = document.createElement("a");
			    link.className = "link";
			    link.onclick = function(){app.fetchDescription(course);};
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
		var schedule = this.autoConstruct(this.selected.concat(this.courses[this.course])).get(this.mode == 'Manual' ? 0 : this.course_list_selection);
		var webClasses = this.webclasses(schedule);
		webWrapper.style.display = webClasses.length ? "" : "none";
		for(var j=0; j<webClasses.length; ++j){
		    var course = webClasses[j];
		    if(course){
			var div = document.createElement("div");
			div.className = "item";
			var creditText = ((course.scheduleTypeDescription == "Laboratory" || course.scheduleTypeDescription == "Recitation") ? 0 : course.creditHours ? course.creditHours : course.creditHourLow ? (course.creditHourHigh ? course.creditHourLow.toString() + '-' + course.creditHourHigh.toString() : course.creditHourLow) : course.creditHourHigh ? course.creditHourHigh : 0);
			div.innerText = course.subject + ' ' + course.courseNumber + '\n' + course.courseTitle.replace(/&ndash;/g, "–") + '\n' + app.genFaculty(course) + '\n' + creditText + ' credit' + (creditText !=1 ? 's' : '') + '\n' + Math.max(0, course.seatsAvailable) + '/' + course.maximumEnrollment + ' seats open\n' + course.courseReferenceNumber + '\n';
			var link = document.createElement("a");
			link.className = "link";
			link.onclick = function(){app.fetchDescription(course);};
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
		this.dayUpdate();
		this.autoBar();

		//Deal with the "you can deselect" thing
		document.getElementById("escTip").style.display = this.course != null && (this.closed || this.courses[this.course].seatsAvailable) ? "" : "none";
	    },
	    fillSearch: function(referrer) {
		var selectBox = document.getElementById("selectBox");
		var val = selectBox.value;
		while(selectBox.lastChild.value != "")
		    selectBox.removeChild(selectBox.lastChild);
		var courses = this.autoFilter(this.courses, referrer);
		for(var i = 0; i < courses.length; i++)
		    selectBox.appendChild(courses[i]);
		selectBox.value = val;
		this.hideSearch();
	    },
	    hideSearch: function(referrer) {
		if(referrer)
		    this.closed = referrer.checked;
		var options = document.getElementById("selectBox").children;
		for(var i=1; i < options.length; ++i)
		    options[i].style.display = this.filterSearch(this.courses[options[i].value]) ? "" : "none";
	    },
            filterSearch: function(course) {
		if(this.selected.indexOf(course) !== -1) return false;
		if (!this.closed && !course.seatsAvailable) return false;

		if(this.search) {
                    var search = this.search.toLowerCase();
		    search = document.getElementById("searchBox").value.toLowerCase();
                    return (course.subject + ' ' + course.courseNumber).toLowerCase().indexOf(search) > -1 ||
			course.courseTitle.toLowerCase().indexOf(search) > -1;
		}
		if(this.mode == "Automatic"){
		    if(this.selected.reduce(function(acc, course){
			return course ? acc.concat([course.home].concat(course.home.alts).concat(course.home.labs)) : acc;
		    }, []).includes(course))
			return false;
		}
		return true;
            },
            fetchDescription: function(course) {
		if(!course.description) {
		    xhrzip("GET", server_cx('searchResults/getCourseDescription/?term=' + course.term.toString() + '&courseReferenceNumber=' + course.courseReferenceNumber.toString()), null, function(){
			Vue.set(course, 'description', this.responseText.replace(/<br>/g, "\r\n").replace(/<BR>/g, "\r\n").trim());
		    });
		}
		this.description = course;
            },
	    autoFilter: function(courses, referrer){ // remove all consecutive duplicates - only in automatic mode
		this.mode = referrer ? referrer.value : this.mode;
		return this.mode == "Manual" ? this.courses_manual : this.courses_auto;
	    },
	    // check if check_course exists within the alts of course_alts, but ONLY if we're in automatic mode
	    autoInAlts: function(check_course, course_alts){ // pretty much just fixes a render bug
		if(check_course == null || course_alts == null)
		    return false; // if there's one or zero, we don't even need to check
		if(this.mode == "Manual")
		    return check_course == course_alts;
		return check_course.home == course_alts.home; // automatic - if check_course is course_alts or is in its alts
	    },
	    // grab the course, and pair it with any labs if available (and in auto). Determines hover style
	    autoAndLabs: function(check_course){ // pretty much just fixes a render bug
		if(check_course == null)
		    return []; // if there's one or zero, we don't even need to check
		if(this.mode == "Manual")
		    return [check_course]; // Manual mode - only hover on one section
		return this.courses_generator ? this.courses_generator.get(this.course_list_selection).filter(course => course && course.home == check_course.home) : [];
	    },
	    // return a Lazy object which spits out valid schedules, and cache it so that Vue templating doesnt calculate it a million times
	    autoConstruct: function(courses){
		if(courses[0] == null) return {get: function(i){return []}}; // no courses - go no further
		if(courses.slice(-1)[0]==null) // remove null at end when no class is selected
		    courses.pop();
		courses = courses.filter(course => course.seatsAvailable || app.closed);
		if(this.mode == "Manual"){
		    if("M"+courses.map(course => course.courseReferenceNumber).join() == this.savedCourseGenerator)
			return this.courses_generator; // don't have to run the calculation for every hour in every day
		    if(this.savedCourseGenerator[0] == "A" && this.course){ // switching from automatic to manual - update app.course
			if(this.courses_generator)
			    if(this.courses_generator.get(this.course_list_selection))
				courses = this.courses_generator.get(this.course_list_selection); // slight optimization for caching
			this.course = courses.filter(function(course){
			    return course.home == app.courses[app.course].home;
			})[0].index; // replace app.course with the proper one automatically assigned
			document.getElementById("selectBox").value = this.course.toString();
			//and fix a render bug
		    }
		    this.savedCourseGenerator = "M"+courses.map(el => el.courseReferenceNumber).join();
		    this.courses_generator = {get: function(i){return courses;}};
		    return this.courses_generator;
		}
		//automatic generator
		if("A"+this.removeDuplicatesBy(course => course.home, courses).map(el => el.home.courseReferenceNumber).filter(c => c).join() + (this.closed ? "C" : "") == this.savedCourseGenerator)
		    return this.courses_generator; // don't have to run the calculation for every hour in every day
		if(this.savedCourseGenerator[0] == "M" && this.course){ // switching from manual to automatic - update app.course
		    this.course = this.courses[this.course].home.index; // basically just a render bug
		    document.getElementById("selectBox").value = this.course.toString();
		}
		this.course_list_selection = 0; // Reset on each new sched gen
		this.courses_generator = new Lazy(this.cartesianProduct(courses.reduce(function(acc, course){
		    var prev_packs = acc.filter(pack => pack[0].home == course.home); // populated with any packs which course is a part of
		    if(prev_packs.length){ // course is either an alt or a lab of a previous course
			var comp_packs = prev_packs.filter(prev_pack => prev_pack.includes(course)); // all the pack(s) that are labs and not alts
			if(comp_packs.length){ // course is a lab of a previous
			    comp_packs.forEach(function(comp_pack){
				acc = acc.filter(pack => pack[0] != comp_pack[0]); // remove the old lab pack(s)
			    });
			    acc.push([course].concat(course.home.labs.filter(c => c!=course))); // and replace with the new ones, w/ course first this time
			}
			// else it's an alt. Ignore for duplicate's sake
		    } else { // course is brand new
			acc.push(course.home.alts.filter(c => c!=course)); // add alts (minus active)
			if(!course.home.labs.length){
			    acc[acc.length-1] = (course == course.home ? [course] : [course, course.home]).concat(acc[acc.length-1]);
			} else { // need to add labs manually
			    if(course.home.labs.includes(course)){
				acc[acc.length-1] = [course.home].concat(acc[acc.length-1]);
				acc.push([course].concat(course.home.labs.filter(c => c!=course)));
			    } else {
				acc[acc.length-1] = (course == course.home ? [course] : [course, course.home]).concat(acc[acc.length-1]);	
				acc.push(course.home.labs);		    
			    }
			}
		    }
		    return acc;
		}, []))).filter(function(schedule){
		    return !schedule.filter(course => !course.seatsAvailable && !app.closed).length;
		}).filter(this.schedCompat);
		this.savedCourseGenerator = "A"+this.removeDuplicatesBy(course => course.home, courses).map(el => el.home.courseReferenceNumber).filter(c => c).join() + (this.closed ? "C" : "");
		return this.courses_generator;
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
		if(this.courses_generator && this.courses_generator.get(this.courses_generator.data ? this.courses_generator.data.length : 0)){ // see if there's more we haven't seen yet
		    this.course_list_selection = (this.courses_generator.data ? this.courses_generator.data.length : 0)-1; // and show it to us
		} else { // done - start looping
		    this.course_list_selection++;
		    this.course_list_selection%=(this.courses_generator ? this.courses_generator.data.length : 0);
		}
		this.fillSchedule();
		var range = document.getElementById("Range");
		range.max = this.courses_generator ? this.courses_generator.data.length-1 : 0;
		range.value = this.course_list_selection;

		button.innerText = (this.courses_generator ? this.courses_generator.done : false) ? "Loop" : "Next";
	    },
	    //Generates a Cartesian Product with given dimensions
	    //Example: [['a', 'b'], ['c', 'd']] => [['a', 'c'],['a', 'd'],['b', 'c'],['b', 'd']]
	    cartesianProduct: function*(dimensions){
		if(dimensions.length <= 1){// no need to calculate for 1 length lists (0 too just in case) - just yield each schedule
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
		var update = function(divs){
		    return function(){
			for(var i=0; i<divs.length; ++i){
			    var div = divs[i];
			    if(app.currentstorage == div.innerText)
				div.classList.add("selected");
			    else
				div.classList.remove("selected");
			}
		    };
		}(options);
		for(var i = 0; i<options.length; ++i)
		    options[i].onclick = function(schedule){
			return function(){app.load(schedule); update();}
		    }(options[i].innerText);
		update();
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
		this.changed = false;
		this.updateSaved();
            },
            load: function(schedule) {
		if(this.changed && this.selected.length) {
                    if (!window.confirm("Are you sure you want to discard your changes?")) {
			return;
                    }
		}
		this.currentstorage = schedule;
		this.changed = false;
		location.hash = this.localStorage[schedule];
		if ((index = this.terms.map(function(el){return el.code}).indexOf(location.hash.slice(1, 7))) > -1)
		{
                    if(this.term != this.terms[index]) {
			this.term = this.terms[index];
			this.changedTerm(true);
                    }
                    else {
			this.course = null;
			document.getElementById("selectBox").value = "";
			this.search = "";
			this.term = this.terms[index];
			var hashes = location.hash.slice(8).split(',');
			this.selected = this.courses.filter(function(course){
			    return hashes.indexOf(course.courseReferenceNumber.toString()) > -1;
			});
                    }
		}
		this.justLoaded = false;
		this.fillSchedule();
            },
            discard: function() {
		if (!window.confirm("Are you sure you want to discard your changes?")) {
                    return;
		}
		this.changed = false;
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
                    this.changed = false;
                    this.clear();
		    this.updateSaved();
		    this.fillSchedule();
		}
            },
            clear: function() {
		if(this.changed)
                    if (!window.confirm("Are you sure you want to discard your changes?"))
			return;
		document.getElementById("selectBox").value = "";
		this.course = null;
		this.selected = [];
		this.currentstorage = null;
		this.justLoaded = false;
		this.updateSaved();
		this.fillSchedule();
		this.hideSearch();
            },
            webclasses: function(courses)
            {
		return courses ? courses.filter(function(course){
		    return course && (course.meetingsFaculty.map(el => el.meetingTime.building == "ONLINE").reduce((a, b) => (a || b), false));
		}) : [];
            },
            changedTerm: function(loadHash = false)
            {
		if(this.currentstorage && loadHash !== true) this.clear();
		this.course = null;
		document.getElementById("selectBox").value = "";
		this.search = "";
		this.selected = [];	
		this.course_list_selection = 0;
		this.courses_generator = null;
		this.saved_course_generator = "";
		this.fillSchedule(); // show empty while loading
		this.percent = "";

		document.getElementById("coursesBox").style.display = "none";
		document.getElementById("loadingCourses").style.display = "";
		/*
		var foundIdx = this.cache.map(courses => courses[0].term).findIndex(el => el==app.courses[0].term);
		if(this.cache.map(courses => courses[0].term).includes(this.courses[0].term) > -1){ // term is in cache
		    this.courses = this.cache[foundIndex];
		    this.genDivs();
		} else { // term isn't in cache - load
		    this.courses = [];
		    this.fetchTerm(this.term.code, this.genDivs);
		    }*/
		this.fetchTerm(this.term.code, function(courses){
		    app.courses = courses;
		    app.genDivs();
		    if(loadHash)
			app.loadHash();
		    app.fillSchedule();
		    app.fillSearch();
		});
	    },
	    fetchTerm: function(term, callback = null){
		xhrzip("POST", server_cx("term/search?mode=search"), "term=" + term + "&studyPath=&studyPathText=&startDatepicker=&endDatepicker=", function() { // This is needed to for cookie spoofing
		    xhrzip("GET", server_cx("searchResults/searchResults?txt_term=" + term + "&startDatepicker=&endDatepicker=&pageOffset=0&pageMaxSize=10&sortColumn=subjectDescription&sortDirection=asc"), null, function () { // we first do a short grab in order to get the max size
			let first_response = JSON.parse(this.responseText);
			let max = first_response.totalCount;
			let data = [first_response];
			let offsets = [];
			for(var i=first_response.data.length; i<test_percent_cap*(max-first_response.data.length)/100; i+=chunk)
			    offsets.push(i); // generate array of all the needed request-offset values
			let percentEnd = offsets[offsets.length-1]+chunk;
			percentEnd = '/' + (percentEnd < max ? percentEnd : max).toString();
			offsets.forEach(function(offset){
			    xhrzip("GET", server_cx("searchResults/searchResults?txt_term=" + term + "&startDatepicker=&endDatepicker=&pageOffset=" + offset.toString() + "&pageMaxSize=" + chunk.toString() + "&sortColumn=subjectDescription&sortDirection=asc"), null, function () {
				let response = JSON.parse(this.responseText);
				data.push(response); // add to array in no particular order
				max -= chunk; // signal completion
				app.percent = data.reduce((acc, el) => acc+el.data.length, 0).toString() + percentEnd;
				if(data[0].totalCount-(max-first_response.data.length) > test_percent_cap*(data[0].totalCount)/100){ // all are done
				    data = data.sort((a, b) => a.pageOffset - b.pageOffset); // sort to proper order
				    var courses = [];
				    data.forEach(function(payload){ // itterate over all responses
					courses = courses.concat(payload.data); // and add to courses
				    });
				    courses = courses.reduce(function(acc, cur){ // post process in preparation for manual mode
					if(acc.length > 0){
					    if(acc[acc.length-1].subjectCourse == cur.subjectCourse && (cur.scheduleTypeDescription == "Laboratory" || cur.scheduleTypeDescription == "Recitation")){ // lab
						var i = acc.length-1;
						for(; !acc[i].labs; --i); // back to home
						cur.home = acc[i];
						acc[i].labs = acc[i].labs.concat(cur);
					    } else if(acc[acc.length-1].subjectCourse == cur.subjectCourse){ // alt
						var i = acc.length-1;
						for(; !acc[i].alts; --i); // back to home
						cur.home = acc[i];
						acc[i].alts = acc[i].alts.concat(cur);
					    } else {
						cur.alts = [];
						cur.labs = [];
						cur.home = cur;
					    }
					    return acc.concat(cur);
					} else {
					    cur.alts = [];
					    cur.labs = [];
					    cur.home = cur;
					    return [cur];
					}
				    }, []);
				    for(var i = 0; i< courses.length; ++i)
					courses[i].index = i;

				    if(callback)
					callback(courses);
				}
			    });
			});
		    });
		});
            },
	    genDivs: function(){
		courses_auto = app.courses.reduce(function(acc, cur){
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
		var saves = document.getElementById("saves");
		for(var i=0; i<saves.children.length; ++i)
		    if(saves.children[i].classList.contains("selected"))
			app.load(saves.children[i].innerText); // in case there are courses rendered that need to be hidden
		document.getElementById("coursesBox").style.display = "";
		document.getElementById("loadingCourses").style.display = "none";
	    },
	    loadHash: function(){ // loading from URL or save, get hash and parse it
		var hashes = location.hash.slice(8).split(',');
		this.selected = this.courses.filter(function(course){
		    return hashes.indexOf(course.courseReferenceNumber.toString()) > -1;
		});
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
            click: function(course)
            {
		if (this.autoInAlts(this.courses[this.course], course)) // needs to be added to selected
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
		this.changed = true;
		this.justLoaded = false;
		this.course_list_selection = 0;
		var range = document.getElementById('Range');
		range.max = 0;
		range.value = 0; // fix render on auto bar
		this.hideSearch(); // TODO: optimize
		this.fillSchedule();
            },
            hashExists: function()
            {
		return location.hash.match(/#\d+=[\d+,?]+/);
            },
            generateHash: function() {
		var hash = this.term.code + "=";
		hash += this.selected.map(function(s){
		    return s.courseReferenceNumber;
		}).join();
		return hash;
            },
	    autoBar: function(){
		var autoBar = document.getElementById("autoBar");
		autoBar.style.display = this.mode == 'Automatic' && this.selected.concat(this.courses[this.course])[0] != null ? "inline-block" : "none";
		document.getElementById('nextButton').innerText='Next';
	    },
	    dayUpdate: function(){
		var test = false;
		if(this.mode == "Automatic"){
		    if(this.courses_generator)
			if(this.courses_generator.data){
			    if(this.courses_generator.data[this.course_list_selection]){
				test = this.courses_generator.data[this.course_list_selection].value;
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
		    test = this.selected.concat(this.courses[this.course]);
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
	}
    });
