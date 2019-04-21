/*
BUG:
I think everything dies when connection is lost during course retrieval


ADD:
If you select on an alternate schedule, maybe start generating from that one?

In automatic mode, include a big indicator when there is no valid sched

If we get a code 500, retry

Okay so turns out you actually need to log in :/
*/
let test_percent_cap = 100; // takes a long time to load on 100%, consider 1% for testing
let chunk = 500; // 500 is the largest the server will honor, and is the fastest
//NOTE: 100 might be a bit faster. This needs more testing
//500: 69000ms
//100: 6500ms
Vue.use(VueResource);
var server_cx = function(h) { return 'https://bannerxe.is.colostate.edu/StudentRegistrationSsb/ssb/' + h; };

let xhrzip = function(method, url, data, onstate){
    let xhr = new XMLHttpRequest(); // we need a new one every time in case we're doing async requests
    xhr.onreadystatechange = function(){ // callback
	if (this.readyState === 4 && this.status === 200)
	    ({responseText: this.responseText, core: onstate}).core(); // this just makes callback look and feel like normal, but always checks for readyness - mostly a convienence thing
    };
    xhr.open(method, url);
    xhr.withCredentials = true; // needed for auth cookies
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded'); // needed for submitting form data
    xhr.send(data);
}

class Lazy{ // a memoized and simplified version of the Lazy class you can find online
    constructor(inputgen){
        this.core = inputgen;
        this.data = [];
    	this.filters = [];
	this.done = false;
    }
    get(i){
        while(!this.done && (this.data.length <= i)){
	    var tmp = this.core.next();
	    if(tmp.done){
		this.done = true;
		break;
	    }
	    if(this.filters.reduce(function(acc, cur_filter){ // run all filters on value
		return acc && cur_filter(tmp.value);
	    }, true)){
		this.data.push({value: tmp.value, selected: tmp.value.filter(function(course){ // cache selected change
		    return !course.home.alts.concat(course.home).includes(app.course); // we need to do this here so it updates the url dynamically
		})});
            }
	}
	var data = this.data[i];
	if(!data)
	    return false; // no valid schedules
	app.selected = data.selected;
	location.hash = app.generateHash(); // update url
        return data.value;
    }
    filter(filter_fun){
	this.filters.push(filter_fun);
	return this;
    }
}

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
            safari: navigator.userAgent.indexOf('Safari') != -1 && navigator.userAgent.indexOf('Chrome') == -1
	},
	mounted: function()
	{
            this.$el.style.display = 'block';
	    xhrzip("GET", server_cx("classSearch/getTerms?searchTerm=&offset=1&max=10&_=1554348528566"), null, function() {
		let response = JSON.parse(this.responseText);
		app.terms = response;
		console.log(response);
		if (app.hashExists() && (index = app.terms.indexOf(location.hash.slice(1, 6))) > -1)
		{
		    app.term = app.terms[index];
		}
		else
		{
		    app.term = app.terms[0];
		}
		app.changedTerm(true);
		if(localStorage.schedules) app.localStorage = JSON.parse(localStorage.schedules);
	    });
	},
	computed:
	{
            totalCredits: function()
            {
		return this.selected.map(function(c){
		    return c.scheduleTypeDescription == "Laboratory" ? 0 : c.creditHours ? c.creditHours : c.creditHourLow ? c.creditHourLow : c.creditHourHigh ? c.creditHourHigh : 0;
		}).concat(0).reduce(function(a, b){
		    return a + b;
		});
            },
	},
	methods:
	{
            fetchDescription: function(course) {
		if(!course.description) {
		    xhrzip("GET", server_cx('searchResults/getCourseDescription/?term=' + course.term.toString() + '&courseReferenceNumber=' + course.courseReferenceNumber.toString()), null, function(){
			Vue.set(course, 'description', this.responseText.replace(/<br>/g, "\r\n").replace(/<BR>/g, "\r\n").trim());
		    });
		}
		this.description = course;
            },
            filterSearch: function(course) {
		if(this.selected.indexOf(course) !== -1) return false;
		if (!this.closed && !course.seatsAvailable) return false;

		if(this.search) {
                    var search = this.search.toLowerCase();
                    return (course.subject + ' ' + course.courseNumber).toLowerCase().indexOf(search) > -1 ||
			course.courseTitle.toLowerCase().indexOf(search) > -1;
		}
		if(this.mode == "Automatic"){
		    if(this.selected.reduce(function(acc, course){
			return course ? acc.concat(course.home.alts.concat(course.home)) : acc;
		    }, []).includes(course))
			return false;
		}
		return true;
            },
	    autoFilter: function(courses){ // remove all consecutive duplicates - only in automatic mode
		return this.mode == "Manual" ? courses : courses.reduce(function(acc, cur){
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
		if(this.mode == "Manual"){
		    if("M"+courses.map(course => course.courseReferenceNumber).join() == this.savedCourseGenerator)
			return this.courses_generator; // don't have to run the calculation for every hour in every day
		    if(this.savedCourseGenerator[0] == "A" && this.course){ // switching from automatic to manual - update app.course
			courses = this.courses_generator.get(this.course_list_selection); // slight optimization for caching
			this.course = courses.filter(function(course){ // This has thrown an error once in its life - be on the lookout as to why
			    return course.home == app.course.home;
			})[0]; // replace app.course with the proper one automatically assigned
		    }
		    this.savedCourseGenerator = "M"+courses.map(function(el){return el.courseReferenceNumber;}).join();
		    this.courses_generator = {get: function(i){return courses;}};
		    return this.courses_generator;
		}
		courses = this.removeDuplicatesBy(course => course.subjectCourse, courses); // remove labs
		//automatic generator
		if("A"+courses.map(function(el){return el.home.courseReferenceNumber;}).filter(c => c).join() == this.savedCourseGenerator)
		    return this.courses_generator; // don't have to run the calculation for every hour in every day
		if(this.savedCourseGenerator[0] == "M" && this.course) // switching from manual to automatic - update app.course
		    this.course = this.course.home; // basically just a render bug
		this.course_list_selection = 0; // Reset on each new sched gen
		this.courses_generator = new Lazy(this.cartesianProduct(courses.reduce(function(acc, course){
		    acc.push(course.home.alts.concat(course.home)); // expand course to list of [alts...]
		    if(course.home.labs.length)
			acc.push(course.home.labs);
		    return acc;
		}, []))).filter(this.schedCompat);
		this.savedCourseGenerator = "A"+courses.map(function(el){return el.home.courseReferenceNumber;}).filter(c => c).join();
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
	    genNext: function(){
		if(this.courses_generator && this.courses_generator.get(this.courses_generator.data.length)){ // see if there's more we haven't seen yet
		    this.course_list_selection = this.courses_generator.data.length-1; // and show it to us
		} else { // done - start looping
		    this.course_list_selection++;
		    this.course_list_selection%=this.courses_generator.data.length;
		}
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
		if(!this.daylist(true).reduce(function(acc, day){ // check if any of the days overlap
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
		console.log(this.localStorage)
            },
            load: function(schedule) {

		if(this.changed && this.selected.length) {
                    if (!window.confirm("Are you sure you want to discard your changes?")) {
			return;
                    }
		}
		if(this.currentstorage === schedule) return;
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
			this.search = "";
			this.term = this.terms[index];
			var hashes = location.hash.slice(8).split(',');
			this.selected = this.courses.filter(function(course){
			    return hashes.indexOf(course.courseReferenceNumber.toString()) > -1;
			});
                    }
		}
		this.justLoaded = false;
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
		}
            },
            clear: function() {

		if(this.changed) {
                    if (!window.confirm("Are you sure you want to discard your changes?")) {
			return;
                    }
		}
		this.selected = [];
		this.currentstorage = null;
		this.justLoaded = false;
            },
            webclasses: function(courses)
            {
		return courses.filter(function(course){
		    return course && (course.meetingsFaculty.map(function(el){return el.meetingTime.building == "ONLINE"}).reduce(function(a, b){return a || b}));
		});
            },
            changedTerm: function(loadHash)
            {
		if(this.currentstorage && loadHash !== true) this.clear();
		this.course = null;
		this.search = "";
		this.courses = [];
		this.selected = [];	
		this.course_list_selection = 0;
		this.courses_generator = null;
		this.saved_course_generator = "";
		//xhrzip("GET", server_cx("searchResults/searchResults?txt_term=" + app.term.code + "&startDatepicker=&endDatepicker=&pageOffset=" + offset.toString() + "&pageMaxSize=" + chunk.toString() + "&sortColumn=subjectDescription&sortDirection=asc"), null, function () {});
		xhrzip("POST", server_cx("term/search?mode=search"), "term=" + this.term.code + "&studyPath=&studyPathText=&startDatepicker=&endDatepicker=", function() { // This is needed to for cookie spoofing
		    xhrzip("GET", server_cx("searchResults/searchResults?txt_term=" + app.term.code + "&startDatepicker=&endDatepicker=&pageOffset=0&pageMaxSize=10&sortColumn=subjectDescription&sortDirection=asc"), null, function () { // we first do a short grab in order to get the max size
			let first_response = JSON.parse(this.responseText);
			let max = first_response.totalCount;
			let data = [first_response];
			let offsets = [];
			for(var i=10; i<test_percent_cap*(max-10)/100; i+=chunk)
			    offsets.push(i); // generate array of all the needed request-offset values
			let percentEnd = offsets[offsets.length-1]+chunk;
			percentEnd = '/' + (percentEnd < max ? percentEnd : max).toString();
			offsets.forEach(function(offset){
			    xhrzip("GET", server_cx("searchResults/searchResults?txt_term=" + app.term.code + "&startDatepicker=&endDatepicker=&pageOffset=" + offset.toString() + "&pageMaxSize=" + chunk.toString() + "&sortColumn=subjectDescription&sortDirection=asc"), null, function () {
				let response = JSON.parse(this.responseText);
				data.push(response); // add to array in no particular order
				max -= chunk; // signal completion
				app.percent = data.reduce((acc, el) => acc+el.data.length, 0).toString() + percentEnd;
				if(data[0].totalCount-(max-10) > test_percent_cap*(data[0].totalCount)/100){ // all are done
				    data = data.sort((a, b) => a.pageOffset - b.pageOffset); // sort to proper order
				    data.forEach(function(payload){ // itterate over all responses
					app.courses = app.courses.concat(payload.data); // and add to courses
				    });
				    app.courses = app.courses.reduce(function(acc, cur){ // post process in preparation for manual mode
					if(acc.length > 0){
					    if(acc[acc.length-1].subjectCourse == cur.subjectCourse && cur.scheduleTypeDescription == "Laboratory"){ // lab
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
				}
			    });
			});
		    });
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
		if (this.autoInAlts(this.course, course)) // needs to be added to selected
		{
                    this.course = null;
		    if(this.mode == "Manual")
			this.selected.push(course)
		    else {
			this.selected.push(course.home);
			this.savedCourseGenerator = "A";
			this.autoConstruct(this.selected).get(0); // force url update
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
	    daylist: function(tolower){
		return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
			this.selected.concat(this.course).map(function(c){
			    if(!c) return false;
			    return c.meetingsFaculty.map(function(m){
				return m.meetingTime.saturday || m.meetingTime.sunday
			    }).reduce(function(a, b){
				return a || b;
			    })
			}).reduce(function(a, b){
			    return a || b
			}) ? "Saturday" : "",
			this.selected.concat(this.course).map(function(c){
			    if(!c) return false;
			    return c.meetingsFaculty.map(function(m){
				return m.meetingTime.sunday
			    }).reduce(function(a, b){
				return a || b;
			    })
			}).reduce(function(a, b){
			    return a || b
			}) ? "Sunday" : ""].filter(function(el){
			    return el!=""
			}).map(function(el){
			    return tolower ? el.toLowerCase() : el;
			});
	    }
	}
    });
