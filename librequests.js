//These values have been found from tested on my machine. Feel free to test yourself
//500---> Finish: 46.84s, 49.08s, 42.61s = 46.176s avg
//400---> Finish: 44.52s, 40.94s, 37.04s = 40.826s avg
//300---> Finish: 38.30s, 35.46s, 38.66s = 37.473s avg ***
//200---> Finish: 42.70s, 43.13s, 38.08s = 41.303s avg
//100---> Finish: 45.26s, 34.36s, 36.82s = 38.813s avg
var server = function(h) { return 'https://bannerxe.is.colostate.edu/StudentRegistrationSsb/ssb/' + h; };

// pre process courses are they're coming in, strip down data for lower memory usage
// js engine usually takes a few seconds to catch up with all the deallocation, thus memory usage takes ~10s to lower
// acts on var contents like a reference in C
function preProcessDataPack(data){
    data.data.forEach(function(course){
	// strip out useless info by building a new course and subbing that in
	["campusDescription", "creditHourIndicator", "crossList", "crossListAvailable", "crossListCapacity",
	 "crossListCount", "enrollment", "id", "isSectionLinked", "linkIdentifier", "openSection", "partOfTerm",
	 "reservedSeatSummary", "subjectDescription", "termDesc", "waitCount"].forEach(function(key){
	     delete course[key];
	 });
	course.meetingsFaculty.forEach(function(meeting){
	    ["category", "class", "courseReferenceNumber", "faculty", "term"].forEach(function(key){
		delete meeting[key];
	    });
	});
    });
}

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
		if(this.readyState == 4)
		    ref.xhr = null;
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
		    return;
		}
		else if(this.status != 200 && this.status != 0){
		    console.log("A network request failed with code " + this.status.toString()); // might need in the future for testing errors
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
	this.main_callback_wrapper.callback = null;
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
			    
			    preProcessDataPack(responseData);
			    TermManager_ref.data.push(responseData); // add response to data...
			    // and check if we're done
			    var loadedAmount = TermManager_ref.data.reduce(function(acc, cur){ // check how many courses we have loaded
				return acc + cur.data.length; // by summing them all up
			    }, 0);
			    app.percent = loadedAmount.toString() + "/" + TermManager_ref.data[0].totalCount.toString();
			    app.updatePercent();
			    if(loadedAmount >= app.test_percent_cap*TermManager_ref.data[0].totalCount/100){ // and see if we've got enough
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
				// finally ready to run the callback. Probably for updating UI
				if(TermManager_ref.main_callback_wrapper.callback) // it's weird because we can't close in the function, we need to make sure it can change
				    TermManager_ref.main_callback_wrapper.callback(TermManager_ref.data);
				
				// if we get here, we automatically know there are no other term requests running
				// so instead of having down time, start looking for other terms to load
				// we'll only work on loading the terms that are sitting in saves because
				// those are most likely to be looked at
				// we won't just load all terms because that's a good bit of data
				var saves = document.getElementById("saves").children;
				var saveTerms = [];
				// look through each save and grab their terms
				for(var i=0; i<saves.length; ++i)
				    saveTerms.push(app.localStorage[saves[i].innerText].split("=")[0]);
				// then look through loaded terms and grab their terms
				var completedTerms = app.termCacher.termManagers.filter(manager => manager.done).map(manager => manager.term);
				// then find the first save term that doesn't have a fully loaded term
				for(var i=0; i<saveTerms.length; ++i){
				    if(!completedTerms.find(term => term == saveTerms[i])){
					// and if we find one, start loading it in the background
					app.termCacher.push(saveTerms[i], null);
					return;
				    }
				}
				// if we reach here, all of our saves are loaded and there's nothing else to do
			    }
			});
		    });
		} else { // first time requesting - do a small request first, then fill up
		    app.percent = "0/?";
		    app.updatePercent();
		    TermManager_ref.headRequest = new Searcher("courses", TermManager_ref.term, 0, 10);
		    TermManager_ref.headRequest.start(function(responseData){
			preProcessDataPack(responseData);
			TermManager_ref.headRequest = null; // head requests are all done
			TermManager_ref.data = [responseData]; // currently wrapped with extra info, will unwrap later
			var min = responseData.data.length; // how many actually loaded with the first request
			//NOTE: Yes, it's not always 10. The server seems to always honor larger requests (100+), but doesn't always give us the amount we ask for with smaller queries, so we have to check this
			var max = responseData.totalCount; // how many courses are in the database
			app.percent = min.toString() + "/" + max.toString();
			app.updatePercent();
			let offsets = []; // stores offset values for each subsequent required request
			for(var i = min; i<app.test_percent_cap*max/100; i+=app.chunk)//NOTE: previously was using app.test_percent_cap*(max-min)/100, but this seems more logical. If error arrises, it's probably from here
			    offsets.push(i); // fill offsets with integer values starting at min, offset by app.chunk size, and going up to only what we need to request
			offsets.forEach(function(offset){ // construct all subsequent requests
			    TermManager_ref.requests.push(new Searcher("courses", TermManager_ref.term, offset, app.chunk));
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
	if(index > -1 && this.termManagers[index].done){ // if it's already done
	    // make sure no others are running, but if they are just let them finish to only cache, not run callback
	    this.termManagers.forEach(function(termManager){
		termManager.main_callback_wrapper.callback = null;
	    });
	    // then run callback for the completed term
	    // following line is same as callback(this.termManagers[index].data) but safer
	    this.termManagers[index].start(callback);
	    return;
	    // we check first in case term is already cached. This way, if another term is loading in and a new
	    // request is made for an already loaded term, we don't bother stopping the one loading and let it
	    // keep loading in the background for a fast switch down the road
	}
	// If we get here, we know we need to start/resume a request, and thus end the other requests
	var activeManager = null;
	if(index > -1) // signaling a resume (instead of a cold start)
	    activeManager = this.termManagers.splice(index, 1)[0]; // remove the active one without stopping it
	this.termManagers.forEach(function(termManager){ // stop all the (other) ones
	    termManager.stop();
	})
	// then resume/start the target manager
	// if it's already in there, we removed it earlier. Just add it back and update the callback
	this.termManagers.push(index > -1 ? activeManager : new TermManager(term));
	this.termManagers[this.termManagers.length-1].start(callback); // and start it
    }
}

app.termCacher = new TermCacher();
app.loading = false;
app.percent = "";
